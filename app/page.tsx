"use client";
import CalendarAssistant from "./CalendarAssistant";
import { GoogleOAuthProvider } from "@react-oauth/google";
export default function Home() {

  return (
    <div className="w-full h-full bg-cover bg-center">
      <GoogleOAuthProvider clientId="481068362595-2mlatnj42p9gg1gj0a9k01e8ri2jkjcq.apps.googleusercontent.com">
        <CalendarAssistant />
      </GoogleOAuthProvider>
    </div>
  );
}