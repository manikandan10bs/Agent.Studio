import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Logo } from '../../components/common/Logo';
import { api } from '../../services/api';
import { Lock, UserCheck, Loader2, ArrowRight, ShieldCheck, Mail } from 'lucide-react';

export const AcceptInvitationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [inviteData, setInviteData] = useState<{ email: string; role: string } | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('No invitation token found in the URL. Please use the complete invitation link provided by your administrator.');
      setLoadingInvite(false);
      return;
    }
    const checkInvite = async () => {
      try {
        const info = await api.getInvitationInfo(token);
        setInviteData(info);
      } catch (err: any) {
        setError(err.message || 'Invitation is invalid or has expired.');
      } finally {
        setLoadingInvite(false);
      }
    };
    checkInvite();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Missing invitation token.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.acceptInvitation(token, password, fullName);
      await refreshUser();
      navigate('/studio', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingInvite) {
    return (
      <div className="min-h-screen w-screen bg-[#F4F7FB] text-slate-800 flex items-center justify-center p-4">
        <div className="flex items-center gap-2.5 text-blue-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm font-semibold">Verifying invitation token...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-[#F4F7FB] bg-studio-dots text-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200/90 p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Activate Your Creator Account</h2>
          <p className="text-xs text-slate-500 mt-1">
            An administrator has invited you to collaborate on AGENT.STUDIO.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        {inviteData && (
          <div className="mb-5 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-600">Invited Email:</span>
              <span className="font-mono font-bold text-blue-900">{inviteData.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-600">Assigned Role:</span>
              <span className="uppercase font-bold text-blue-700 text-[11px] bg-blue-100 px-2 py-0.2 rounded-full">
                {inviteData.role}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
              Your Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alex Morgan"
              className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white shadow-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
              Set Password
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
              Confirm Password
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white shadow-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !inviteData}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm disabled:opacity-40 transition-all"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Activate & Enter Studio</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
