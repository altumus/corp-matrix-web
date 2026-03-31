import { useAuthStore } from '../store/authStore.js'

export function useAuth() {
  return useAuthStore()
}
