import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from './supabase';

let initialized = false;

async function guardarTokenEnSupabase(token) {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error(
        'LARA_PUSH_USER_ERROR:',
        userError
      );
      return;
    }

    if (!user) {
      console.warn(
        'LARA_PUSH_NO_USER'
      );
      return;
    }

    const { error } = await supabase
      .from('push_devices')
      .upsert(
        {
          user_id: user.id,
          fcm_token: token,
          platform: 'android',
          device_name: 'Samsung S20 FE',
          enabled: true,
          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict: 'fcm_token',
        }
      );

    if (error) {
      console.error(
        'LARA_PUSH_SAVE_ERROR:',
        error
      );
      return;
    }

    console.log(
      'LARA_PUSH_TOKEN_SAVED'
    );
  } catch (error) {
    console.error(
      'LARA_PUSH_SAVE_EXCEPTION:',
      error
    );
  }
}

export async function initPushNotifications() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  if (initialized) {
    return;
  }

  initialized = true;

  try {
    await PushNotifications.createChannel({
      id: 'lara_admin',
      name: 'Lara XV Admin',
      description:
        'Notificaciones importantes de Lara XV',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
    });

    await PushNotifications.addListener(
      'registration',
      async (token) => {
        console.log(
          'LARA_FCM_TOKEN:',
          token.value
        );

        localStorage.setItem(
          'lara_fcm_token',
          token.value
        );

        await guardarTokenEnSupabase(
          token.value
        );
      }
    );

    await PushNotifications.addListener(
      'registrationError',
      (error) => {
        console.error(
          'LARA_FCM_ERROR:',
          error
        );
      }
    );

    await PushNotifications.addListener(
      'pushNotificationReceived',
      (notification) => {
        console.log(
          'LARA_PUSH_RECEIVED:',
          notification
        );
      }
    );

    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action) => {
        console.log(
          'LARA_PUSH_OPENED:',
          action
        );

        const data =
          action.notification?.data || {};

        if (data.url) {
          window.location.href =
            data.url;
        }
      }
    );

    let permission =
      await PushNotifications.checkPermissions();

    if (
      permission.receive === 'prompt'
    ) {
      permission =
        await PushNotifications.requestPermissions();
    }

    if (
      permission.receive !== 'granted'
    ) {
      console.warn(
        'LARA_PUSH_PERMISSION_DENIED'
      );

      return;
    }

    await PushNotifications.register();

    console.log(
      'LARA_PUSH_INITIALIZED'
    );
  } catch (error) {
    initialized = false;

    console.error(
      'LARA_PUSH_INIT_ERROR:',
      error
    );
  }
}