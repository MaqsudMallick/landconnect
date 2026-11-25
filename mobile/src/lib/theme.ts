export const colors = {
  primary: '#0F6E56',
  primaryDark: '#0A4F3E',
  accent: '#25B46A',
  accentSoft: '#E3F6EC',
  background: '#F4F6F5',
  surface: '#FFFFFF',
  chatBackground: '#EFEAE2',
  bubbleMine: '#D9FDD3',
  bubbleTheirs: '#FFFFFF',
  text: '#111B21',
  textMuted: '#667781',
  border: '#E2E8E5',
  danger: '#D93F3F',
  warning: '#C77D0A',
  callBackground: '#0B1F1A',
};

export const roleColors: Record<string, { background: string; text: string }> = {
  buyer: { background: '#E7F0FF', text: '#1D4ED8' },
  seller: { background: '#E3F6EC', text: '#0F6E56' },
  broker: { background: '#FFF4E0', text: '#B45309' },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 };
