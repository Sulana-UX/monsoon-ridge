import { Link } from 'react-router-dom'
import { MapPin, Phone, Mail, Facebook, Instagram, Twitter, Youtube } from 'lucide-react'
import Logo from './Logo'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-about">
          <Logo light />
          <p>
            A jungle sanctuary high on the ridge, where timeless Sri Lankan hospitality meets
            modern luxury. Slow down, breathe deep and let the monsoon set your pace.
          </p>
          <div className="socials">
            <a href="#" aria-label="Facebook"><Facebook size={18} /></a>
            <a href="#" aria-label="Instagram"><Instagram size={18} /></a>
            <a href="#" aria-label="Twitter"><Twitter size={18} /></a>
            <a href="#" aria-label="YouTube"><Youtube size={18} /></a>
          </div>
        </div>

        <div>
          <h4>Explore</h4>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/rooms">Rooms &amp; Suites</Link></li>
            <li><Link to="/my-bookings">My Bookings</Link></li>
            <li><Link to="/contact">Contact Us</Link></li>
          </ul>
        </div>

        <div>
          <h4>Experiences</h4>
          <ul>
            <li>Riverside Dining</li>
            <li>Ayurveda Spa</li>
            <li>Sunset Boat Rides</li>
            <li>Village Cycling Tours</li>
          </ul>
        </div>

        <div>
          <h4>Get in Touch</h4>
          <ul className="footer-contact">
            <li><MapPin size={16} /> 18 Cliffside Road, Ella, Sri Lanka</li>
            <li><Phone size={16} /> +94 11 234 5678</li>
            <li><Mail size={16} /> stay@monsoonridge.lk</li>
          </ul>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Monsoon Ridge Jungle Resort. All rights reserved.</span>
        <span>Privacy Policy · Terms of Service</span>
      </div>
    </footer>
  )
}
