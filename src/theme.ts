import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#b39ddb', // Deep Purple Light
      dark: '#7e57c2', // Deep Purple
      light: '#d1c4e9',
    },
    secondary: {
      main: '#651fff', // Deep Purple Accent
    },
    success: { main: '#0ca30c' },
    warning: { main: '#fab219' },
    error: { main: '#d03b3b' },
    info: { main: '#3987e5' },
    background: {
      default: '#0a0a0a',
      paper: 'rgba(25, 20, 35, 0.6)', // Glass effect base
    },
    text: {
      primary: '#f3e5f5',
      secondary: '#b39ddb',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#050505',
          backgroundImage: 'radial-gradient(circle at 50% 0%, #1e0b3b 0%, #050505 50%)',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
          color: '#f3e5f5',
        },
        '::-webkit-scrollbar': {
          width: '8px',
          height: '8px',
        },
        '::-webkit-scrollbar-track': {
          background: 'rgba(255, 255, 255, 0.05)',
        },
        '::-webkit-scrollbar-thumb': {
          background: 'rgba(179, 157, 219, 0.3)',
          borderRadius: '4px',
        },
        '::-webkit-scrollbar-thumb:hover': {
          background: 'rgba(179, 157, 219, 0.6)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(179, 157, 219, 0.15)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
          borderRadius: '16px',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, rgba(126, 87, 194, 0.8) 0%, rgba(101, 31, 255, 0.8) 100%)',
          boxShadow: '0 4px 15px 0 rgba(101, 31, 255, 0.3)',
          '&:hover': {
            background: 'linear-gradient(135deg, rgba(126, 87, 194, 1) 0%, rgba(101, 31, 255, 1) 100%)',
          },
        },
        outlinedPrimary: {
          borderColor: 'rgba(179, 157, 219, 0.5)',
          color: '#d1c4e9',
          '&:hover': {
            borderColor: '#b39ddb',
            backgroundColor: 'rgba(179, 157, 219, 0.1)',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(179, 157, 219, 0.1)',
          color: '#f3e5f5',
        },
        head: {
          fontWeight: 700,
          color: '#b39ddb',
          backgroundColor: 'rgba(25, 20, 35, 0.4)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          backgroundColor: 'rgba(15, 10, 25, 0.85)',
          border: '1px solid rgba(179, 157, 219, 0.2)',
        },
      },
    },
  },
});
