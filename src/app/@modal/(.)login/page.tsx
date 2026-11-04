import { LoginModal } from '@/components/auth/LoginModal';

/** Intercepts a client-side move to /login and shows it over the current page. */
export default function InterceptedLogin() {
  return <LoginModal />;
}
