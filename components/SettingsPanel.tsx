
import React, { useState } from 'react';
import { Settings, User } from '../types';
import { DEFAULT_WALLPAPER } from '../services/utils';
import { Database, Image, UserCircle, Save, X, Lock } from 'lucide-react';

interface SettingsPanelProps {
  settings: Settings;
  setSettings: (s: Settings) => void;
  currentUser: User;
  onUpdateUser: (u: User) => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, setSettings, currentUser, onUpdateUser, onClose }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [newPassword, setNewPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'source' | 'ui' | 'user'>('source');

  const handleSave = () => {
    setSettings(localSettings);
    if (newPassword) {
      onUpdateUser({ ...currentUser, password: newPassword });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose}></div>
      <div className="relative w-full max-w-2xl bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden flex flex-col h-[80vh] animate-in slide-in-from-bottom-10">
        
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 bg-blue-500 rounded-full"></div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter">TRUNG TÂM CẤU HÌNH</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Thiết lập PHYKYTV theo ý muốn</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/10">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-1/3 border-r border-white/5 p-6 space-y-2">
            <button onClick={() => setActiveTab('source')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all font-black text-xs uppercase tracking-widest ${activeTab === 'source' ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-gray-400'}`}>
              <Database size={18} /> Nguồn phát
            </button>
            <button onClick={() => setActiveTab('ui')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all font-black text-xs uppercase tracking-widest ${activeTab === 'ui' ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-gray-400'}`}>
              <Image size={18} /> Giao diện
            </button>
            <button onClick={() => setActiveTab('user')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all font-black text-xs uppercase tracking-widest ${activeTab === 'user' ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-gray-400'}`}>
              <UserCircle size={18} /> Tài khoản
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {activeTab === 'source' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                   <p className="text-[10px] font-bold text-blue-400 leading-relaxed uppercase">Lưu ý: Hệ thống hỗ trợ link trực tiếp (.m3u8), link PHP và link từ Google Drive (ID công khai).</p>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">Nguồn Tivi Online (M3U8 List)</label>
                  <input 
                    type="text" 
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                    value={localSettings.tvSourceUrl}
                    onChange={(e) => setLocalSettings({...localSettings, tvSourceUrl: e.target.value})}
                    placeholder="Dán link nguồn tivi tại đây..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">Nguồn List EPG (Lịch phát sóng)</label>
                  <input 
                    type="text" 
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                    value={localSettings.epgUrl}
                    onChange={(e) => setLocalSettings({...localSettings, epgUrl: e.target.value})}
                    placeholder="Link file XMLTV..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">Nguồn Phim Truyện (M3U8 List)</label>
                  <input 
                    type="text" 
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                    value={localSettings.movieSourceUrl}
                    onChange={(e) => setLocalSettings({...localSettings, movieSourceUrl: e.target.value})}
                    placeholder="Dán link nguồn phim tại đây..."
                  />
                </div>
              </div>
            )}

            {activeTab === 'ui' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">Hình nền hệ thống (Image URL)</label>
                  <input 
                    type="text" 
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                    value={localSettings.wallpaper}
                    onChange={(e) => setLocalSettings({...localSettings, wallpaper: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[DEFAULT_WALLPAPER, "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0", "https://images.unsplash.com/photo-1511447333015-45b65e60f6d5"].map((img, i) => (
                    <button key={i} onClick={() => setLocalSettings({...localSettings, wallpaper: img})} className="aspect-video rounded-xl overflow-hidden border border-white/10 hover:border-blue-500 transition-all">
                      <img src={img} className="w-full h-full object-cover" alt="Wall" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'user' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center gap-6 p-6 bg-white/5 rounded-3xl border border-white/10">
                  <img src={currentUser.avatar} className="w-20 h-20 rounded-2xl border-2 border-white/20" alt="avatar" />
                  <div>
                    <p className="text-xl font-black">{currentUser.username}</p>
                    <p className="text-[10px] text-blue-500 font-bold uppercase tracking-[0.2em]">{currentUser.role === 'admin' ? 'Quản trị viên hệ thống' : 'Người dùng'}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">Thay đổi mật khẩu đăng nhập</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input 
                      type="password" 
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nhập mật khẩu mới..."
                    />
                  </div>
                  <p className="mt-2 text-[9px] text-gray-600 italic">Để trống nếu không muốn thay đổi mật khẩu hiện tại.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <button className="py-3 bg-white/5 border border-white/10 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all">Tạo tài khoản mới</button>
                  <button className="py-3 bg-white/5 border border-white/10 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all">Chỉnh sửa hồ sơ</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 bg-black/40 border-t border-white/5 flex justify-end gap-4">
          <button onClick={onClose} className="px-8 py-3.5 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all">Hủy bỏ</button>
          <button onClick={handleSave} className="px-10 py-3.5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 transition-all flex items-center gap-3">
            <Save size={16} /> Lưu cấu hình
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;