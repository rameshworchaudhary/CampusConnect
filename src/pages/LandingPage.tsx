import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const featureCards = [
  {
    title: 'Club Profiles',
    description: 'Every club gets a page with its details, members and activities.',
  },
  {
    title: 'Member Registration',
    description: 'Students request to join and clubs approve them.',
  },
  {
    title: 'Event Creation',
    description: 'Clubs create events and students register in one tap.',
  },
  {
    title: 'Announcements',
    description: 'Club and campus updates reach the right people.',
  },
  {
    title: 'Role-Based Access',
    description: 'Students, club admins and the admin each see what they need.',
  },
  {
    title: 'Admin Dashboard',
    description: 'The admin approves clubs and oversees students and events.',
  },
];

const steps = [
  {
    number: '1.',
    title: 'Create an account',
    description: 'Sign up as a student or register a club.',
  },
  {
    number: '2.',
    title: 'Admin approval',
    description: 'New clubs are reviewed and approved by the admin.',
  },
  {
    number: '3.',
    title: 'Join and participate',
    description: 'Browse clubs, register for events and stay updated.',
  },
];

export const LandingPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handlePrimaryAction = () => {
    if (isAuthenticated) {
      const route = user?.role === 'SUPER_ADMIN' ? '/admin' : user?.role === 'CLUB_ADMIN' ? '/club-admin' : '/student';
      navigate(route);
      return;
    }

    navigate('/login');
  };

  const handleSecondaryAction = () => {
    navigate('/register');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#faf9f5', color: '#111111', fontFamily: 'Manrope, sans-serif' }}>
      <header
        style={{
          maxWidth: 1360,
          margin: '0 auto',
          padding: '28px 64px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800 }}>
          Campus<span style={{ fontWeight: 400 }}>Connect</span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 15 }}>
          <a href="#" style={{ color: '#111111', textDecoration: 'none' }}>Clubs</a>
          <a href="#" style={{ color: '#111111', textDecoration: 'none' }}>Events</a>
          <a href="#how-it-works" style={{ color: '#111111', textDecoration: 'none' }}>How it works</a>
          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{
              background: '#fff',
              color: '#000',
              border: '1px solid #000',
              borderRadius: 10,
              padding: '10px 16px',
              font: '600 14px Manrope, sans-serif',
              cursor: 'pointer',
            }}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={handleSecondaryAction}
            style={{
              background: '#000',
              color: '#fff',
              border: '1px solid #000',
              borderRadius: 10,
              padding: '10px 16px',
              font: '600 14px Manrope, sans-serif',
              cursor: 'pointer',
            }}
          >
            Sign Up
          </button>
        </nav>
      </header>

      <main style={{ maxWidth: 1360, margin: '0 auto', padding: '0 64px 40px' }}>
        <section
          style={{
            display: 'flex',
            gap: 48,
            alignItems: 'center',
            padding: '80px 0 60px',
          }}
        >
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 56, lineHeight: 1.1, fontWeight: 800 }}>
              Every campus club, one place.
            </h1>
            <p
              style={{
                fontSize: 18,
                lineHeight: 1.6,
                margin: '20px 0 32px',
                maxWidth: 520,
                color: '#222222',
              }}
            >
              Discover clubs, register as a member, join events and never miss an announcement. Clubs get their own space to manage everything.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handlePrimaryAction}
                style={{
                  background: '#000',
                  color: '#fff',
                  border: '1px solid #000',
                  borderRadius: 10,
                  padding: '16px 24px',
                  font: '600 16px Manrope, sans-serif',
                  cursor: 'pointer',
                }}
              >
                {isAuthenticated ? 'Go to Dashboard' : 'Join as Student'}
              </button>
              <button
                type="button"
                onClick={handleSecondaryAction}
                style={{
                  background: '#fff',
                  color: '#000',
                  border: '1px solid #000',
                  borderRadius: 10,
                  padding: '16px 24px',
                  font: '600 16px Manrope, sans-serif',
                  cursor: 'pointer',
                }}
              >
                Register your Club
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              height: 360,
              border: '1px solid #000',
              borderRadius: 20,
              background: '#000',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <img
              src="/campus-connect-hero.png"
              alt="CampusConnect illustration showing campus clubs, events, and announcements"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        </section>

        <section
          style={{
            padding: '40px 64px',
            background: '#000',
            color: '#fff',
            borderRadius: 0,
          }}
        >
          <h2 style={{ margin: '0 0 24px', fontSize: 28 }}>What you can do</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
            {featureCards.map((feature) => (
              <div
                key={feature.title}
                style={{
                  border: '1px solid #fff',
                  borderRadius: 14,
                  padding: 24,
                  background: '#000',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 17 }}>{feature.title}</div>
                <div style={{ fontSize: 14, marginTop: 8, lineHeight: 1.5, color: '#f3f3f3' }}>{feature.description}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" style={{ padding: '64px 0 40px' }}>
          <h2 style={{ margin: '0 0 24px', fontSize: 28 }}>How it works</h2>

          <div style={{ display: 'flex', gap: 24 }}>
            {steps.map((step) => (
              <div key={step.title} style={{ flex: 1, borderTop: '3px solid #000', paddingTop: 14 }}>
                <div style={{ fontWeight: 800 }}>{step.number} {step.title}</div>
                <div style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>{step.description}</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer
        style={{
          maxWidth: 1360,
          margin: '0 auto',
          padding: '24px 64px 40px',
          borderTop: '1px solid #000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 13,
        }}
      >
        <span>© 2025 CampusConnect</span>
      </footer>
    </div>
  );
};

export default LandingPage;
