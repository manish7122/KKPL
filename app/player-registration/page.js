'use client';

import { useState } from 'react';
import './registration.css';

export default function PlayerRegistrationPage() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  async function submitRegistration(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError(false);

    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    try {
      const photoFile = form.elements.photo.files[0];
      if (!photoFile) throw new Error('Please choose a player photo.');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(photoFile.type) ||
          photoFile.size === 0 || photoFile.size > 5 * 1024 * 1024) {
        throw new Error('Choose a JPG, PNG, or WebP photo no larger than 5 MB.');
      }
      values.photoData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('Could not read the selected player photo.'));
        reader.onerror = () => reject(new Error('Could not read the selected player photo.'));
        reader.readAsDataURL(photoFile);
      });
      delete values.photo;
      const response = await fetch('/api/player-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          age: Number(values.age)
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Registration could not be submitted.');

      form.reset();
      setMessage('Your player details have been submitted successfully.');
    } catch (submitError) {
      setError(true);
      setMessage(submitError.message || 'Registration could not be submitted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="player-registration-page">
      <section className="player-registration-card">
        <div className="player-registration-brand">KKPL <span>PLAYER REGISTRATION</span></div>
        <h1>Join the Player Pool</h1>
        <p className="player-registration-intro">
          Submit your player details to be added to the KKPL auction player list.
          Your auction tier and base price will be set by default and can be updated by the admin.
        </p>
        <form className="player-registration-form" onSubmit={submitRegistration}>
          <label>
            Player name *
            <input name="name" type="text" autoComplete="name" maxLength="100" required suppressHydrationWarning />
          </label>
          <div className="player-registration-row">
            <label>
              Age *
              <input name="age" type="number" min="16" max="45" step="1" required suppressHydrationWarning />
            </label>
            <label>
              Playing role *
              <select name="category" required defaultValue="" suppressHydrationWarning>
                <option value="" disabled>Select role</option>
                <option value="Raider">Raider</option>
                <option value="Defender">Defender</option>
                <option value="All-Rounder">All-Rounder</option>
              </select>
            </label>
          </div>
          <label>
            Nationality
            <input name="nationality" type="text" autoComplete="country-name" maxLength="80" suppressHydrationWarning />
          </label>
          <label>
            Player photo * (JPG, PNG, or WebP; max 5 MB)
            <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required suppressHydrationWarning />
          </label>
          <label>
            Previous team
            <input name="prevTeam" type="text" maxLength="120" suppressHydrationWarning />
          </label>
          <label>
            Skills and playing experience
            <textarea name="skills" rows="4" maxLength="500" suppressHydrationWarning />
          </label>
          <label className="player-registration-trap" aria-hidden="true">
            Website
            <input name="website" type="text" tabIndex="-1" autoComplete="off" suppressHydrationWarning />
          </label>
          <button type="submit" disabled={submitting} suppressHydrationWarning>
            {submitting ? 'Submitting...' : 'Submit Player Details'}
          </button>
          <p className={`player-registration-message${error ? ' is-error' : ''}`} aria-live="polite">
            {message}
          </p>
        </form>
        <p className="player-registration-footnote">Fields marked * are required. Admin can update your details and auction information.</p>
      </section>
    </main>
  );
}
