/*
Copyright 2021 New Vector Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, {
  useCallback,
  useEffect,
  useState,
  createContext,
  useMemo,
  useContext,
} from "react";
import { useHistory } from "react-router-dom";
import { initClient } from "./matrix-utils";

const ClientContext = createContext();

export function ClientProvider({ children }) {
  const history = useHistory();
  const [
    { loading, isAuthenticated, isPasswordlessUser, client, userName },
    setState,
  ] = useState({
    loading: true,
    isAuthenticated: false,
    isPasswordlessUser: false,
    client: undefined,
    userName: null,
  });

  useEffect(() => {
    async function restore() {
      try {
        const authStore = localStorage.getItem("matrix-auth-store");

        if (authStore) {
          const {
            user_id,
            device_id,
            access_token,
            passwordlessUser,
            tempPassword,
          } = JSON.parse(authStore);

          const client = await initClient({
            baseUrl: defaultHomeserver,
            accessToken: access_token,
            userId: user_id,
            deviceId: device_id,
          });

          localStorage.setItem(
            "matrix-auth-store",
            JSON.stringify({
              user_id,
              device_id,
              access_token,

              passwordlessUser,
              tempPassword,
            })
          );

          return { client, passwordlessUser };
        }

        return { client: undefined };
      } catch (err) {
        localStorage.removeItem("matrix-auth-store");
        throw err;
      }
    }

    restore()
      .then(({ client, passwordlessUser }) => {
        setState({
          client,
          loading: false,
          isAuthenticated: !!client,
          isPasswordlessUser: !!passwordlessUser,
          userName: client?.getUserIdLocalpart(),
        });
      })
      .catch(() => {
        setState({
          client: undefined,
          loading: false,
          isAuthenticated: false,
          isPasswordlessUser: false,
          userName: null,
        });
      });
  }, []);

  const changePassword = useCallback(
    async (password) => {
      const { tempPassword, passwordlessUser, ...existingSession } = JSON.parse(
        localStorage.getItem("matrix-auth-store")
      );

      await client.setPassword(
        {
          type: "m.login.password",
          identifier: {
            type: "m.id.user",
            user: existingSession.user_id,
          },
          user: existingSession.user_id,
          password: tempPassword,
        },
        password
      );

      localStorage.setItem(
        "matrix-auth-store",
        JSON.stringify({
          ...existingSession,
          passwordlessUser: false,
        })
      );

      setState({
        client,
        loading: false,
        isAuthenticated: true,
        isPasswordlessUser: false,
        userName: client.getUserIdLocalpart(),
      });
    },
    [client]
  );

  const setClient = useCallback((client, session) => {
    if (client) {
      localStorage.setItem("matrix-auth-store", JSON.stringify(session));

      setState({
        client,
        loading: false,
        isAuthenticated: true,
        isPasswordlessUser: !!session.passwordlessUser,
        userName: client.getUserIdLocalpart(),
      });
    } else {
      localStorage.removeItem("matrix-auth-store");

      setState({
        client: undefined,
        loading: false,
        isAuthenticated: false,
        isPasswordlessUser: false,
        userName: null,
      });
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("matrix-auth-store");
    window.location = "/";
  }, [history]);

  const context = useMemo(
    () => ({
      loading,
      isAuthenticated,
      isPasswordlessUser,
      client,
      changePassword,
      logout,
      userName,
      setClient,
    }),
    [
      loading,
      isAuthenticated,
      isPasswordlessUser,
      client,
      changePassword,
      logout,
      userName,
      setClient,
    ]
  );

  return (
    <ClientContext.Provider value={context}>{children}</ClientContext.Provider>
  );
}

export function useClient() {
  return useContext(ClientContext);
}
