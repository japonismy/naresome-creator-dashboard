import React from 'react';
import {createRoot} from 'react-dom/client';
import Dashboard from '../app/dashboard';
import '../app/globals.css';
import '../app/usability.css';
import '../app/dark-theme.css';
import '../app/review.css';
import '../app/creator.css';
import '../app/list.css';
import '../app/workspace.css';
import '../app/branding.css';

const home=new URL('.',document.baseURI);
window.__NARESOME_STATIC__={manifestUrl:new URL('data/manifest.json',home).href,homeUrl:home.href};
createRoot(document.getElementById('root')!).render(<Dashboard/>);
