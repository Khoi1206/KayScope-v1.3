import { create } from 'zustand'

export type SidebarSection = 'collections' | 'environments' | 'history' | 'globals'

interface UiStore {
  sidebarSection: SidebarSection
  setSidebarSection: (section: SidebarSection) => void

  // Modal open state
  modals: Record<string, boolean>
  openModal: (id: string) => void
  closeModal: (id: string) => void
  isModalOpen: (id: string) => boolean
}

export const useUiStore = create<UiStore>((set, get) => ({
  sidebarSection: 'collections',
  setSidebarSection: (section) => set({ sidebarSection: section }),

  modals: {},
  openModal: (id) => set(s => ({ modals: { ...s.modals, [id]: true } })),
  closeModal: (id) => set(s => ({ modals: { ...s.modals, [id]: false } })),
  isModalOpen: (id) => get().modals[id] ?? false,
}))
