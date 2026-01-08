"use client";
import React, { useState, useEffect } from 'react';
import {
  UserPlus, Mail, Calendar, CheckCircle,
  XCircle, Shield, Edit2, Trash2, Search,
  MoreVertical, Filter, UserCheck, ShieldAlert,
  UserCog
} from 'lucide-react';
import { showToast } from './Toast.js';

export const UserManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Example user data - in a real app, this would be fetched from your backend
  const [users, setUsers] = useState([
    { id: 1, name: 'Alex Johnson', email: 'alex@seasonality.io', role: 'Super Admin', status: 'Active', joined: '2023-10-12', lastLogin: '2 hours ago' },
    { id: 2, name: 'Sarah Miller', email: 'sarah.m@finance.pro', role: 'Editor', status: 'Active', joined: '2024-01-05', lastLogin: '1 day ago' },
    { id: 3, name: 'David Chen', email: 'dchen@data-engine.net', role: 'Viewer', status: 'Inactive', joined: '2023-12-18', lastLogin: '2 weeks ago' },
    { id: 4, name: 'Elena Gomez', email: 'elena.g@seasonality.io', role: 'Editor', status: 'Active', joined: '2024-03-22', lastLogin: '5 mins ago' },
    { id: 5, name: 'Marcus Wright', email: 'mwright@corporate.com', role: 'Viewer', status: 'Active', joined: '2024-02-14', lastLogin: '3 days ago' },
  ]);

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role) => {
    switch (role) {
      case 'Super Admin':
        return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'Editor':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Viewer':
        return 'bg-slate-50 text-slate-600 border-slate-100';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  const handleDeleteUser = (id, name) => {
    if (window.confirm(`Are you sure you want to revoke access for ${name}?`)) {
      setUsers(users.filter(u => u.id !== id));
      showToast('success', `Access revoked for ${name}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Main Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserCog className="w-5 h-5 text-indigo-600" />
            Access Control
          </h4>
          <p className="text-xs text-slate-500 font-medium italic">Manage administrative permissions and team seats</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center justify-center space-x-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span className="text-sm font-bold">Invite Member</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email address..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <button className="flex items-center space-x-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            <Filter className="w-4 h-4" />
            <span>Roles</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            <UserCheck className="w-4 h-4" />
            <span>Active Only</span>
          </button>
        </div>
      </div>

      {/* User Table Card */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Team Member</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Authority</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Activity</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold border-2 border-white shadow-sm ring-1 ring-indigo-50">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-none">{user.name}</p>
                          <div className="flex items-center text-[11px] text-slate-400 mt-1">
                            <Mail className="w-3 h-3 mr-1 opacity-50" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getRoleBadge(user.role)}`}>
                          {user.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center space-x-1.5 text-xs font-bold ${user.status === 'Active' ? 'text-emerald-500' : 'text-slate-400'}`}>
                        {user.status === 'Active' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>{user.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center text-[11px] text-slate-500">
                          <Calendar className="w-3 h-3 mr-1.5 opacity-50" />
                          Joined {user.joined}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">Last active {user.lastLogin}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end space-x-2">
                        <button className="p-2 hover:bg-white text-slate-400 hover:text-indigo-600 rounded-lg transition-all shadow-sm border border-transparent hover:border-indigo-100">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          className="p-2 hover:bg-white text-slate-400 hover:text-rose-600 rounded-lg transition-all shadow-sm border border-transparent hover:border-rose-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                      <ShieldAlert className="w-12 h-12 text-slate-300" />
                      <p className="text-sm font-medium text-slate-500 italic">No team members match your current filters</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Pagination Info */}
      <div className="flex items-center justify-between px-2">
        <p className="text-xs text-slate-400 font-medium italic">
          Total system access grants: <span className="text-slate-900 font-bold">{users.length} members</span>
        </p>
        <div className="flex gap-2">
          <button className="px-4 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-400 bg-white cursor-not-allowed">Previous</button>
          <button className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 hover:bg-slate-50 shadow-sm transition-all">Next</button>
        </div>
      </div>

      {/* Invite Modal (Mock) */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">Provision Team Access</h3>
              <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <XCircle className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Email Address</label>
                <input
                  type="email"
                  placeholder="john@example.com"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Grant Level</label>
                <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100">
                  <option>Viewer</option>
                  <option>Editor</option>
                  <option>Super Admin</option>
                </select>
              </div>
            </div>
            <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  showToast('success', 'Invitation dispatched successfully');
                  setShowInviteModal(false);
                }}
                className="flex-1 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
