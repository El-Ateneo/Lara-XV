import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

import Regalo from './pages/Regalo';
import Guest from './pages/Guest';
import Admin from './pages/Admin';
import Display from './pages/Display';
import Pase from './pages/Pase';

import {
  initPushNotifications,
} from './lib/pushNotifications';

function App() {
  const isNative =
    Capacitor.isNativePlatform();

  useEffect(() => {
    if (isNative) {
      initPushNotifications();
    }
  }, [isNative]);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to={
                isNative
                  ? '/admin'
                  : '/guest'
              }
              replace
            />
          }
        />

        <Route
          path="/guest"
          element={<Guest />}
        />

        <Route
          path="/admin"
          element={<Admin />}
        />

        <Route
          path="/display"
          element={<Display />}
        />

        <Route
          path="/regalo"
          element={<Regalo />}
        />

        <Route
          path="/pase/:id"
          element={<Pase />}
        />

        <Route
          path="*"
          element={
            <Navigate
              to={
                isNative
                  ? '/admin'
                  : '/guest'
              }
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;