'use client';

import { useState, useEffect } from 'react';
import PageBreadcrumb from '@/components/common/PageBreadCrumb';
import Button from '@/components/ui/button/Button';
import Input from '@/components/form/input/InputField';
import Label from '@/components/form/Label';
import { EnvelopeIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface PlatformSettings {
  email_forwarding_domain?: string;
}

export default function EmailForwardingPage() {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [stats, setStats] = useState({
    totalAddresses: 0,
    activeAddresses: 0,
  });

  useEffect(() => {
    loadSettings();
    loadStatistics();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/platform/settings');
      if (response.ok) {
        const data = await response.json();
        const emailDomain = data.settings?.email_forwarding_domain;
        if (emailDomain) {
          // Handle both string and object formats
          const domainValue = typeof emailDomain === 'string' 
            ? emailDomain 
            : emailDomain?.value || emailDomain?.domain;
          setDomain(domainValue || '');
        } else {
          // Fallback to env var default
          setDomain(process.env.NEXT_PUBLIC_EMAIL_FORWARDING_DOMAIN || 'receipts.fincat.co.uk');
        }
      } else {
        setError('Failed to load settings');
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      // This would require a separate endpoint or we can add it to the settings API
      // For now, we'll skip this or add it later
    } catch (err) {
      console.error('Error loading statistics:', err);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Validate domain format
      const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
      if (!domainRegex.test(domain)) {
        setError('Invalid domain format. Must be a valid domain name (e.g., receipts.example.com)');
        setSaving(false);
        return;
      }

      const response = await fetch('/api/platform/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          setting_key: 'email_forwarding_domain',
          setting_value: { value: domain },
          description: 'Email forwarding domain for tenant-specific email addresses',
        }),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Email Forwarding Configuration" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Email Forwarding Configuration
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Configure the email domain used for generating tenant-specific email addresses for receiving invoices and receipts.
          </p>
        </div>

        {/* Configuration Form */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="space-y-6">
            <div>
              <Label htmlFor="email-domain">Email Forwarding Domain</Label>
              <div className="mt-2">
                <Input
                  id="email-domain"
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="receipts.example.com"
                  disabled={loading || saving}
                  className="w-full"
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  This domain will be used to generate unique email addresses for each user.
                  Format: receipts-{'{user-id}'}@{'{domain}'}
                </p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                <XCircleIcon className="h-5 w-5" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                <CheckCircleIcon className="h-5 w-5" />
                <span>Settings saved successfully!</span>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={loading || saving || !domain}
                className="min-w-[120px]"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </div>

        {/* Information Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start gap-3">
            <EnvelopeIcon className="h-6 w-6 text-blue-500" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                How It Works
              </h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>
                  • Each user gets a unique email address: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">receipts-{'{user-id}'}@{'{domain}'}</code>
                </li>
                <li>
                  • Users can forward invoices and receipts to their unique address
                </li>
                <li>
                  • The system automatically processes emails and creates financial documents
                </li>
                <li>
                  • Expenses are automatically attributed to the correct user
                </li>
                <li>
                  • Supports future expense tracking and auto-categorization per user
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Statistics Section (Placeholder) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Usage Statistics
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Addresses Generated</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalAddresses}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Addresses</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.activeAddresses}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

