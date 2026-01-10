import { createClient } from '@supabase/supabase-js';

/**
 * Accessing environment variables. 
 * We use process.env here because vite.config.ts is configured to define these 
 * during the build process, ensuring compatibility with Vercel's environment variable system.
 */
const url = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || '';
const key = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || '';

// Verify configuration - ensure we have a valid URL and a real JWT-style key
export const isConfigured = !!(
    url && 
    url.startsWith('https://') && 
    !url.includes('placeholder') &&
    key && 
    key.length > 20
);

/**
 * VirtualSupabase: A local-first database engine that mimics Supabase API.
 * This ensures the app works "without any problems" even if cloud keys are missing.
 * UPDATE: Added strict mode to simulate real security.
 */
class VirtualSupabase {
    private users: any[] = [];
    private profiles: any[] = [];
    private currentSession: any = null;
    private listeners: Array<(event: string, session: any) => void> = [];

    constructor() {
        try {
            const savedUsers = localStorage.getItem('toristori_virtual_users');
            const savedProfiles = localStorage.getItem('toristori_virtual_profiles');
            const savedSession = localStorage.getItem('toristori_virtual_session');
            if (savedUsers) this.users = JSON.parse(savedUsers);
            if (savedProfiles) this.profiles = JSON.parse(savedProfiles);
            if (savedSession) this.currentSession = JSON.parse(savedSession);
        } catch (e) { console.warn("Local DB Init Error", e); }
    }

    private save() {
        localStorage.setItem('toristori_virtual_users', JSON.stringify(this.users));
        localStorage.setItem('toristori_virtual_profiles', JSON.stringify(this.profiles));
        if (this.currentSession) {
            localStorage.setItem('toristori_virtual_session', JSON.stringify(this.currentSession));
        } else {
            localStorage.removeItem('toristori_virtual_session');
        }
    }

    private notify(event: string) {
        this.listeners.forEach(l => l(event, this.currentSession));
    }

    auth = {
        getSession: async () => ({ data: { session: this.currentSession }, error: null }),
        onAuthStateChange: (callback: any) => {
            this.listeners.push(callback);
            setTimeout(() => callback('INITIAL_SESSION', this.currentSession), 0);
            return { data: { subscription: { unsubscribe: () => {
                this.listeners = this.listeners.filter(l => l !== callback);
            }}}};
        },
        signUp: async ({ email, password }: any) => {
            await new Promise(r => setTimeout(r, 800));
            if (this.users.find(u => u.email === email)) {
                return { error: { message: "This email is already registered." } };
            }
            const newUser = { id: `local-${Date.now()}`, email, password };
            this.users.push(newUser);
            // Default welcome credits: 1000
            this.profiles.push({ id: newUser.id, credits: 1000, created_at: new Date().toISOString() });
            this.save();
            return { data: { user: newUser }, error: null };
        },
        signInWithPassword: async ({ email, password }: any) => {
            await new Promise(r => setTimeout(r, 600));
            const user = this.users.find(u => u.email === email);
            
            // STRICT CHECK: User must exist and password must match
            if (!user) {
                return { error: { message: "Account not found. Please register first." } };
            }
            
            if (user.password !== password) {
                return { error: { message: "Invalid password for this production ID." } };
            }

            this.currentSession = { user: { id: user.id, email: user.email }, access_token: 'local-jwt' };
            this.save();
            this.notify('SIGNED_IN');
            return { data: { session: this.currentSession }, error: null };
        },
        signInWithOAuth: async ({ provider, options }: any) => {
            // Note: Real OAuth requires valid SUPABASE_URL and Keys. 
            // In simulator mode, we just bridge to a mock social ID.
            await new Promise(r => setTimeout(r, 1000));
            const mockEmail = `social-user@${provider}.com`;
            let user = this.users.find(u => u.email === mockEmail);
            
            if (!user) {
                user = { id: `social-${provider}-${Date.now()}`, email: mockEmail, password: 'oauth-protected' };
                this.users.push(user);
                this.profiles.push({ id: user.id, credits: 1000, created_at: new Date().toISOString() });
            }

            this.currentSession = { user: { id: user.id, email: user.email }, access_token: `mock-${provider}-jwt` };
            this.save();
            this.notify('SIGNED_IN');
            return { data: { provider, url: options?.redirectTo || window.location.origin }, error: null };
        },
        signOut: async () => {
            this.currentSession = null;
            this.save();
            this.notify('SIGNED_OUT');
            return { error: null };
        }
    };

    from(table: string) {
        return {
            select: (cols: string) => ({
                eq: (col: string, val: any) => ({
                    single: async () => {
                        if (table === 'profiles') {
                            const p = this.profiles.find(p => p.id === val);
                            return { data: p, error: p ? null : { code: 'PGRST116', message: "No rows" } };
                        }
                        return { data: null, error: null };
                    }
                })
            }),
            update: (updates: any) => ({
                eq: (col: string, val: any) => ({
                    then: async (cb: any) => {
                        if (table === 'profiles') {
                            this.profiles = this.profiles.map(p => p.id === val ? { ...p, ...updates } : p);
                            this.save();
                        }
                        if (cb) cb();
                        return { data: updates, error: null };
                    }
                })
            }),
            insert: (rows: any[]) => ({
                select: () => ({
                    single: async () => {
                        if (table === 'profiles') {
                            this.profiles.push(...rows);
                            this.save();
                            return { data: rows[0], error: null };
                        }
                        return { data: null, error: null };
                    }
                })
            })
        };
    }
}

// Initialize with real client if configured, otherwise fallback to Virtual engine
export const supabase: any = isConfigured 
    ? createClient(url, key)
    : new VirtualSupabase();