import React from 'react';
import {
  BuzolaProvider,
  Outlet,
  Link,
  useParams,
  useNavigate,
  useRoute,
} from 'buzola';
import { routes } from './routes';

// ─── Route components ───────────────────────────────────────────────────────

export function RootLayout() {
  return (
    <div>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
        <Link to="/users">Users</Link>
        <Link to="/users/:userId" params={{ userId: "1" }}>User 1</Link>
        <Link to="/users/:userId" params={{ userId: "2" }}>User 2</Link>
        <Link to="/users/:userId/settings" params={{ userId: "1" }}>User 1 Settings</Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export function Home() {
  return (
    <div>
      <h1>Home</h1>
      <p>Welcome to Buzola playground! This app demonstrates config-based routing.</p>
    </div>
  );
}

export function About() {
  return (
    <div>
      <h1>About</h1>
      <p>Buzola is a modern SPA router built on the Navigation API.</p>
    </div>
  );
}

export function UsersLayout() {
  return (
    <div>
      <h1>Users</h1>
      <Outlet />
    </div>
  );
}

export function UsersList() {
  return (
    <div>
      <h2>All Users</h2>
      <ul>
        <li><Link to="/users/:userId" params={{ userId: "1" }}>Alice (ID: 1)</Link></li>
        <li><Link to="/users/:userId" params={{ userId: "2" }}>Bob (ID: 2)</Link></li>
        <li><Link to="/users/:userId" params={{ userId: "3" }}>Charlie (ID: 3)</Link></li>
      </ul>
    </div>
  );
}

export function UserDetail() {
  const params = useParams<{ userId: string }>();
  const route = useRoute();
  return (
    <div>
      <h2>User Detail</h2>
      <div className="params">
        <p>userId: {params.userId}</p>
        <p>pathname: {route.pathname}</p>
      </div>
      <p style={{ marginTop: '1rem' }}>
        <Link to="/users/:userId/settings" params={{ userId: params.userId }}>Settings</Link>
      </p>
    </div>
  );
}

export function UserSettings() {
  const params = useParams<{ userId: string }>();
  const navigate = useNavigate();
  return (
    <div>
      <h2>User Settings</h2>
      <div className="params">
        <p>userId: {params.userId}</p>
      </div>
      <p style={{ marginTop: '1rem' }}>
        <button onClick={() => navigate('/users/:userId', { params: { userId: params.userId } })}>
          Back to profile
        </button>
      </p>
    </div>
  );
}

export function NotFound() {
  return (
    <div>
      <h1>404</h1>
      <p>Page not found.</p>
      <Link to="/">Go home</Link>
    </div>
  );
}

// ─── App ────────────────────────────────────────────────────────────────────

export function App() {
  return <BuzolaProvider routes={routes} />;
}
