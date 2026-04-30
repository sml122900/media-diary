import { create } from 'zustand';
import { getMe } from '../api/auth';

const storedToken = localStorage.getItem('token');

const useAuthStore = create((set) => ({
  user: null,
  token: storedToken,
  isLoading: !!storedToken,

  login: (token, user) => {
    localStorage.setItem('token', token);
    set({ token, user, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null, isLoading: false });
  },

  init: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const res = await getMe();
      set({ token, user: res.data.user, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      set({ token: null, user: null, isLoading: false });
    }
  },
}));

export default useAuthStore;
