import { createContext, useContext, useEffect, useState } from 'react'
import {
  onIdTokenChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile,
  sendEmailVerification, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider, signOut,
} from 'firebase/auth'
import { auth, api } from '../lib/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [, setVersion] = useState(0)

  useEffect(() => {
    // Fires on sign-in, sign-out and whenever the ID token (with its claims) refreshes
    return onIdTokenChanged(auth, async (u) => {
      setUser(u)
      if (!u) {
        setIsAdmin(false)
        setLoading(false)
        return
      }
      const token = await u.getIdTokenResult()
      setIsAdmin(token.claims.admin === true)
      setLoading(false)
    })
  }, [])

  // Once per verified sign-in, ask the server whether this account is staff.
  // The server sets the claim; the browser can't grant itself admin.
  useEffect(() => {
    if (!user?.emailVerified) return
    let live = true
    api.syncAdminClaim()
      .then(({ data }) => { if (live && data.changed) user.getIdToken(true) })
      .catch(() => { /* non-critical */ })
    return () => { live = false }
  }, [user?.uid, user?.emailVerified]) // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    user,
    isAdmin,
    loading,
    signIn: (email, password) => signInWithEmailAndPassword(auth, email.trim(), password),
    signUp: async (name, email, password) => {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      await updateProfile(cred.user, { displayName: name.trim() })
      await sendEmailVerification(cred.user)
      return cred.user
    },
    signInWithGoogle: () => {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      return signInWithPopup(auth, provider)
    },
    resetPassword: (email) => sendPasswordResetEmail(auth, email.trim()),
    resendVerification: () => sendEmailVerification(auth.currentUser),
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
