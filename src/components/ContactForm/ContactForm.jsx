'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import './ContactForm.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRIP_HTML = (str) => str.replace(/<[^>]*>/g, '');
const generateId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const ContactForm = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [errorMessage, setErrorMessage] = useState('');
  const submittingRef = useRef(false);
  const successTimerRef = useRef(null);
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const messageRef = useRef(null);
  const statusRef = useRef(null);

  const fieldRefs = { name: nameRef, email: emailRef, message: messageRef };

  // Cleanup success timer on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    if (!formData.email.trim() || !EMAIL_REGEX.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData.message.trim() || formData.message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
    }

    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error for this field as user types
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }

    // Cancel auto-clear if user starts typing during success state
    if (status === 'success') {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
      setStatus('idle');
    }
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    // Ref-based lock to prevent double submit
    if (submittingRef.current) return;

    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Focus first invalid field
      const firstErrorField = ['name', 'email', 'message'].find((f) => newErrors[f]);
      if (firstErrorField && fieldRefs[firstErrorField]?.current) {
        fieldRefs[firstErrorField].current.focus();
      }
      return;
    }

    const accessKey = process.env.NEXT_PUBLIC_WEB3FORMS_KEY;
    if (!accessKey) {
      console.error('[ContactForm] NEXT_PUBLIC_WEB3FORMS_KEY is not set');
      setStatus('error');
      setErrorMessage('Contact form is not configured. Please try again later.');
      return;
    }

    submittingRef.current = true;
    setStatus('submitting');
    setErrors({});

    const submissionId = generateId();
    console.info(`[ContactForm] Submitting form (id: ${submissionId})`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const sanitizedData = {
        access_key: accessKey,
        name: STRIP_HTML(formData.name.trim()),
        email: STRIP_HTML(formData.email.trim()),
        message: STRIP_HTML(formData.message.trim()),
        botcheck: '',
        submission_id: submissionId,
      };

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(sanitizedData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const result = await response.json();

      if (response.ok && result.success) {
        console.info(`[ContactForm] Success (id: ${submissionId})`);
        setStatus('success');
        setFormData({ name: '', email: '', message: '' });

        // Auto-clear success message after 5s (cancelled on unmount or user typing)
        successTimerRef.current = setTimeout(() => {
          setStatus('idle');
          successTimerRef.current = null;
        }, 5000);
      } else {
        console.info(`[ContactForm] API error (id: ${submissionId}): ${result.message || 'Unknown'}`);
        setStatus('error');
        setErrorMessage(result.message || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.info(`[ContactForm] Timeout (id: ${submissionId})`);
        setStatus('error');
        setErrorMessage('Request timed out. Please try again.');
      } else {
        console.info(`[ContactForm] Network error (id: ${submissionId}): ${err.message}`);
        setStatus('error');
        setErrorMessage('Network error. Please check your connection and try again.');
      }
    } finally {
      submittingRef.current = false;
    }
  }, [formData]);

  return (
    <form className="contact-form" onSubmit={handleSubmit} noValidate>
      {/* Honeypot field — hidden from users, catches bots */}
      <input
        type="checkbox"
        name="botcheck"
        className="contact-form-honeypot"
        tabIndex={-1}
        autoComplete="off"
      />

      <div className="cf-field">
        <label htmlFor="cf-name" className="cf-label mono">NAME</label>
        <input
          ref={nameRef}
          id="cf-name"
          name="name"
          type="text"
          className={`cf-input${errors.name ? ' cf-input-error' : ''}`}
          placeholder="Your name"
          value={formData.name}
          onChange={handleChange}
          aria-invalid={errors.name ? 'true' : undefined}
          aria-describedby={errors.name ? 'cf-name-error' : undefined}
          disabled={status === 'submitting'}
          autoComplete="name"
        />
        {errors.name && (
          <span id="cf-name-error" className="cf-error mono" role="alert">
            {errors.name}
          </span>
        )}
      </div>

      <div className="cf-field">
        <label htmlFor="cf-email" className="cf-label mono">EMAIL</label>
        <input
          ref={emailRef}
          id="cf-email"
          name="email"
          type="email"
          className={`cf-input${errors.email ? ' cf-input-error' : ''}`}
          placeholder="your@email.com"
          value={formData.email}
          onChange={handleChange}
          aria-invalid={errors.email ? 'true' : undefined}
          aria-describedby={errors.email ? 'cf-email-error' : undefined}
          disabled={status === 'submitting'}
          autoComplete="email"
        />
        {errors.email && (
          <span id="cf-email-error" className="cf-error mono" role="alert">
            {errors.email}
          </span>
        )}
      </div>

      <div className="cf-field">
        <label htmlFor="cf-message" className="cf-label mono">MESSAGE</label>
        <textarea
          ref={messageRef}
          id="cf-message"
          name="message"
          className={`cf-textarea${errors.message ? ' cf-input-error' : ''}`}
          placeholder="Tell me about your project or inquiry..."
          rows={5}
          value={formData.message}
          onChange={handleChange}
          aria-invalid={errors.message ? 'true' : undefined}
          aria-describedby={errors.message ? 'cf-message-error' : undefined}
          disabled={status === 'submitting'}
        />
        {errors.message && (
          <span id="cf-message-error" className="cf-error mono" role="alert">
            {errors.message}
          </span>
        )}
      </div>

      <button
        type="submit"
        className="cf-submit"
        disabled={status === 'submitting'}
      >
        {status === 'submitting' ? (
          <>
            <span className="cf-spinner" />
            SENDING...
          </>
        ) : (
          'SEND MESSAGE'
        )}
      </button>

      {/* Status messages — aria-live region */}
      <div ref={statusRef} className="cf-status" aria-live="polite" aria-atomic="true">
        {status === 'success' && (
          <p className="cf-status-success">
            Message sent successfully. I'll get back to you soon.
          </p>
        )}
        {status === 'error' && (
          <p className="cf-status-error">
            {errorMessage}
          </p>
        )}
      </div>

      {/* Privacy notice */}
      <p className="cf-privacy mono">
        Your information is sent via Web3Forms and used only to respond to your inquiry.
      </p>
    </form>
  );
};

export default ContactForm;
