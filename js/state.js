export const PAGE_SIZE = 6;

export const state = {
  words: [],
  texts: [],
  wildcards: [],
  currentPage: 1,
  currentFilter: 'all',
  searchQuery: '',
  currentRoll: [],
  rollCount: 4,
  wildcardActive: false,
  userName: null,
  progress: { searched: 0, recited: 0, composed: 0, total: 0 }
};
