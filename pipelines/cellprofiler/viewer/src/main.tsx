import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/geist';
import { App } from './App';
import './ui/salk-tokens.css';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');
createRoot(root).render(<StrictMode><App /></StrictMode>);
