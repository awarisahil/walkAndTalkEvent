import { BrowserRouter, Route, Routes } from "react-router-dom";

function HomePage() {
  return (
    <div>
      <h1>Event Platform</h1>
      <p>Home Page</p>
    </div>
  );
}

function LoginPage() {
  return (
    <div>
      <h1>Login</h1>
    </div>
  );
}

function RegisterPage() {
  return (
    <div>
      <h1>Register</h1>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div>
      <h1>404</h1>
      <p>Page not found.</p>
    </div>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}