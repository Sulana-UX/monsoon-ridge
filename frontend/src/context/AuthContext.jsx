import { createContext, useContext, useEffect, useRef, useState } from 'react'
import {
  onIdTokenChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile,
  sendEmailVerification, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider, signOut,
} from 'firebase/auth'
import { auth, api } from '../lib/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [role, setRole] = useState(null) // 'admin' | 'frontdesk' | null (guest)
  const [loading, setLoading] = useState(true)
  const [, setVersion] = useState(0)
  const reloaded = useRef(null) // uid we already refreshed from the server this session

  useEffect(() => {
    // Fires on sign-in, sign-out and whenever the ID token (with its claims) refreshes
    return onIdTokenChanged(auth, async (u) => {
      setUser(u)
      if (!u) {
        setIsAdmin(false)
        setRole(null)
        setLoading(false)
        return
      }
      // Verified in another tab or on the phone (by clicking the email link)? This tab still has
      // the old "not verified" copy of the account, so fetch it fresh once per session.
      if (!u.emailVerified && reloaded.current !== u.uid) {
        reloaded.current = u.uid
        await u.reload().catch(() => {})
        if (u.emailVerified) {
          await u.getIdToken(true).catch(() => {}) // token now says email_verified for the server
          setVersion((v) => v + 1)
        }
      }
      const token = await u.getIdTokenResult()
      setIsAdmin(token.claims.admin === true)
      // Staff without a role claim yet (older sign-ins of owners) are treated as admin;
      // the server checks the real role on every request anyway.
      setRole(token.claims.admin === true ? token.claims.role || 'admin' : null)
      setLoading(false)
    })
  }, [])

  // Every time a verified user opens the site (and right after verifying), ask the server
  // whether this account is staff and which role. The server sets the claim; the browser
  // can't grant itself access. A changed claim refreshes the token → dashboard appears.
  const verified = Boolean(user?.emailVerified)
  useEffect(() => {
    if (!user || !verified) return
    let live = true
    api.syncAdminClaim()
      .then(({ data }) => { if (live && data.changed) user.getIdToken(true) })
      .catch(() => { /* non-critical */ })
    return () => { live = false }
  }, [user?.uid, verified]) // eslint-disable-line react-hooks/exhaustive-deps

  // Verification email: the hotel's own sender first (arrives more reliably), Firebase as fallback
  const sendVerificationEmail = async (u) => {
    try {
      const r = await api.sendVerification()
      if (r?.status === 'sent' || r?.status === 'already') return
    } catch { /* fall back below */ }
    await sendEmailVerification(u)
  }

  const value = {
    user,
    isAdmin,
    role,
    isManager: role === 'admin',
    loading,
    signIn: (email, password) => signInWithEmailAndPassword(auth, email.trim(), password),
    signUp: async (name, email, password) => {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      await updateProfile(cred.user, { displayName: name.trim() })
      await sendVerificationEmail(cred.user)
      return cred.user
    },
    signInWithGoogle: () => {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      return signInWithPopup(auth, provider)
    },
    resetPassword: async (email) => {
      try {
        const r = await api.passwordReset(email.trim())
        if (r?.status === 'sent') return
      } catch (e) {
        if (e.code === 'api/invalid-argument' || e.code === 'api/resource-exhausted') throw e
      }
      await sendPasswordResetEmail(auth, email.trim())
    },
    resendVerification: () => sendVerificationEmail(auth.currentUser),
    // After clicking the link in the email, reload so emailVerified becomes true
    refreshUser: async () => {
      await auth.currentUser?.reload()
      await auth.currentUser?.getIdToken(true) // new token carries email_verified for the server
      setVersion((v) => v + 1) // same user object, mutated by reload(): force a re-render
      return auth.currentUser
    },
    logout: () => signOut(auth),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
