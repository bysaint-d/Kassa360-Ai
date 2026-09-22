import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { User } from '../types';
import { UserCheck, Shield, KeyRound, LogOut, Check, X, AlertCircle } from 'lucide-react';

interface UserSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserSwitchModal: React.FC<UserSwitchModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, allUsers, switchUser, login, logout } = useStore();
  const [selectedUser, setSelectedUser] = useState<User | null>(currentUser);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const getRoleBadge = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-200">Administrator</span>;
      case 'manager':
        return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">Menecer</span>;
      case 'seller':
        return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Satıcı / Kassir</span>;
      case 'warehouse':
        return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">Anbardar</span>;
      default:
        return null;
    }
  };

  const handleQuickSwitch = (user: User) => {
    setError(null);
    setSelectedUser(user);
    // If switching to non-admin or quick switch in POS session
    switchUser(user);
    onClose();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsLoading(true);
    setError(null);

    const success = await login(selectedUser.username, password);
    setIsLoading(false);
    if (success) {
      setPassword('');
      onClose();
    } else {
      setError('Şifrə yanlışdır. Zəhmət olmasa təkrar cəhd edin.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold">İstifadəçi Dəyişdir / Kassa Növbəsi</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Aktiv Kassir / Satıcı Seçin
            </p>
            <div className="grid grid-cols-1 gap-2">
              {allUsers.map((user) => {
                const isCurrent = currentUser?.id === user.id;
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleQuickSwitch(user)}
                    className={`w-full p-3 rounded-xl text-left border transition flex items-center justify-between cursor-pointer ${
                      isCurrent
                        ? 'border-blue-500 bg-blue-50/60 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                        isCurrent ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {user.fullName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          {user.fullName}
                          {isCurrent && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-md font-bold">Aktiv</span>}
                        </div>
                        <div className="text-xs text-slate-500">@{user.username}</div>
                      </div>
                    </div>
                    <div>{getRoleBadge(user.role)}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-600" />
              Sürətli növbə dəyişməsi aktivdir
            </span>
            <button
              type="button"
              onClick={() => {
                logout();
                onClose();
              }}
              className="text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Çıxış et
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
