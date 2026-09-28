import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

import Landing from '@/pages/Landing';
import JoinWizard from '@/pages/Join';
import ParentLogin from '@/pages/ParentLogin';
import ParentPortal from '@/pages/ParentPortal';

import StaffLayout from '@/pages/staff/Layout';
import Dashboard from '@/pages/staff/Dashboard';
import Players from '@/pages/staff/Players';
import Signin from '@/pages/staff/Signin';
import Attendance from '@/pages/staff/Attendance';
import Ensign from '@/pages/staff/Ensign';
import StaffManage from '@/pages/staff/StaffManage';
import Documents from '@/pages/staff/Documents';
import Housekeeping from '@/pages/staff/Housekeeping';
import Settings from '@/pages/staff/Settings'
import Events from '@/pages/staff/Events';
import Messages from '@/pages/staff/Messages';
import AuditLog from '@/pages/staff/AuditLog';
import Transactions from '@/pages/staff/Transactions';
import EqualOpsSurvey from '@/pages/EqualOpsSurvey';
import EqualOps from '@/pages/staff/EqualOps';

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  layout: {
    applicationName: "KJIHC Player Management",
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.png`,
  },
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.png`,
  },
  variables: {
    colorPrimary: "hsl(210, 100%, 12%)",
    colorForeground: "hsl(210, 100%, 12%)",       
    colorMutedForeground: "hsl(215, 16%, 47%)",  
    colorDanger: "hsl(0, 84%, 60%)",
    colorBackground: "hsl(0, 0%, 100%)",       
    colorInput: "hsl(214, 32%, 91%)",            
    colorInputForeground: "hsl(210, 100%, 12%)",  
    colorNeutral: "hsl(214, 32%, 91%)",          
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg border border-slate-100",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-black font-['Outfit']",
    headerSubtitle: "text-slate-500",
    socialButtonsBlockButtonText: "font-semibold",
    formFieldLabel: "font-semibold text-slate-800",
    footerActionLink: "text-blue-600 font-semibold hover:text-blue-800",
    footerActionText: "text-slate-500",
    dividerText: "text-slate-400 font-medium",
    identityPreviewEditButton: "text-blue-600",
    formFieldSuccessText: "text-green-600",
    alertText: "text-slate-800",
    logoBox: "h-12 w-auto mx-auto mb-4",
    logoImage: "h-full w-auto",
    socialButtonsBlockButton: "border-slate-200 hover:bg-slate-50",
    formButtonPrimary: "bg-[#001f3f] hover:bg-[#001f3f]/90 text-white font-semibold h-11",
    formFieldInput: "border-slate-200 h-11 bg-slate-50",
    footerAction: "mt-4",
    dividerLine: "bg-slate-200",
    alert: "bg-red-50 border-red-200",
    otpCodeFieldInput: "border-slate-200",
    formFieldRow: "mb-4",
    main: "p-6",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center relative overflow-hidden bg-[#0b1936] px-4">
      {/* Background elements */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 60px)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 overflow-hidden select-none pointer-events-none"
        aria-hidden="true"
        style={{ lineHeight: 1 }}
      >
        <span
          className="block font-black uppercase tracking-tighter whitespace-nowrap"
          style={{
            fontSize: "clamp(80px, 22vw, 260px)",
            color: "rgba(255,255,255,0.04)",
            letterSpacing: "-0.04em",
            transform: "translateY(18%)",
          }}
        >
          KILMARNOCK
        </span>
      </div>

      <div className="relative z-10 w-full max-w-[440px] flex flex-col items-center">
        <img src={`${basePath}/logo.png`} alt="KJIHC" className="h-20 w-auto mb-8 drop-shadow-xl" />
        <div className="w-full relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-[#f6a800]/20 to-[#f6a800]/0 rounded-3xl blur-lg pointer-events-none" />
          <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl={`${basePath}/staff`} />
        </div>
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={`${basePath}/staff`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function StaffRoute({ component: Component }: { component: React.ComponentType<any> }) {
  return (
    <StaffLayout>
      <Component />
    </StaffLayout>
  );
}

function ProtectedStaffRoute({ component: Component }: { component: React.ComponentType<any> }) {
  return (
    <>
      <Show when="signed-in">
        <StaffRoute component={Component} />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center">
        <h1 className="text-6xl font-black font-display text-primary mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-8">Page not found</p>
        <a href="/" className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium">Return Home</a>
      </div>
    </div>
  )
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      localization={{
        signIn: {
          start: {
            title: "Staff Login",
            subtitle: "Sign in to manage KJIHC club operations",
            actionText: "",
            actionLink: "",
          },
          emailCode: {
            title: "Check Your Email",
            formTitle: "Verification code",
            resendButton: "Didn't receive a code? Resend",
          },
          emailLink: {
            title: "Check Your Email",
            resendButton: "Resend link",
          },
          password: {
            title: "Staff Login",
          },
          alternativeMethods: {
            title: "Staff Login",
          },
          forgotPassword: {
            title: "Reset Your Password",
          },
          resetPassword: {
            title: "Set a New Password",
          },
          resetPasswordMfa: {},
        },
        signUp: {
          start: {
            title: "Staff Login",
            subtitle: "Account registration is restricted. Contact your club administrator.",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={Landing} />
            <Route path="/join" component={JoinWizard} />
            <Route path="/parent-login" component={ParentLogin} />
            <Route path="/parent" component={ParentPortal} />
            <Route path="/equal-ops" component={EqualOpsSurvey} />
            
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={() => { window.location.replace(`${basePath}/sign-in`); return null; }} />
            
            <Route path="/staff" component={() => <ProtectedStaffRoute component={Dashboard} />} />
            <Route path="/staff/players" component={() => <ProtectedStaffRoute component={Players} />} />
            <Route path="/staff/signin" component={() => <ProtectedStaffRoute component={Signin} />} />
            <Route path="/staff/attendance" component={() => <ProtectedStaffRoute component={Attendance} />} />
            <Route path="/staff/ensign" component={() => <ProtectedStaffRoute component={Ensign} />} />
            <Route path="/staff/staff" component={() => <ProtectedStaffRoute component={StaffManage} />} />
            <Route path="/staff/documents" component={() => <ProtectedStaffRoute component={Documents} />} />
            <Route path="/staff/housekeeping" component={() => <ProtectedStaffRoute component={Housekeeping} />} />
            <Route path="/staff/events" component={() => <ProtectedStaffRoute component={Events} />} />
            <Route path="/staff/messages" component={() => <ProtectedStaffRoute component={Messages} />} />
            <Route path="/staff/transactions" component={() => <ProtectedStaffRoute component={Transactions} />} />
            <Route path="/staff/audit" component={() => <ProtectedStaffRoute component={AuditLog} />} />
            <Route path="/staff/equal-ops" component={() => <ProtectedStaffRoute component={EqualOps} />} />
            <Route path="/staff/settings" component={() => <ProtectedStaffRoute component={Settings} />} />

            <Route component={NotFound} />
          </Switch>
        </TooltipProvider>
        <Toaster />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
