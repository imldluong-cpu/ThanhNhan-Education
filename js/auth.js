// ============================================
// AUTHENTICATION MODULE
// ============================================

const Auth = {
    currentUser: null,
    currentUserDoc: null,
    listeners: [],

    // Initialize auth
    init() {
        return new Promise(async (resolve) => {
            let resolved = false;
            const doResolve = (user) => {
                if (!resolved) { resolved = true; resolve(user); }
            };

            // Step 1: Check if returning from Google redirect
            try {
                const result = await window.auth.getRedirectResult();
                if (result && result.user) {
                    console.log('✅ Redirect login:', result.user.email);
                    // User signed in via redirect - set up immediately
                    this.currentUser = result.user;
                    try {
                        await this.ensureUserDoc(result.user);
                    } catch(e) {
                        console.warn('Firestore fallback:', e);
                        this.currentUserDoc = this.makeFallbackDoc(result.user);
                    }
                    window.currentUser = this.currentUserDoc;
                    this.notifyListeners();
                    doResolve(result.user);
                }
            } catch (error) {
                console.warn('Redirect check:', error.message);
            }

            // Step 2: Listen for auth state (handles cached sessions & sign-out)
            window.auth.onAuthStateChanged(async (user) => {
                console.log('🔄 Auth state:', user ? user.email : 'signed out');
                if (user) {
                    this.currentUser = user;
                    if (!this.currentUserDoc || this.currentUserDoc.id !== user.uid) {
                        try {
                            await this.ensureUserDoc(user);
                        } catch(e) {
                            console.warn('Firestore fallback:', e);
                            this.currentUserDoc = this.makeFallbackDoc(user);
                        }
                    }
                    window.currentUser = this.currentUserDoc;
                } else {
                    this.currentUser = null;
                    this.currentUserDoc = null;
                    window.currentUser = null;
                }
                this.notifyListeners();
                doResolve(user);
            });

            // Safety timeout
            setTimeout(() => {
                console.warn('⏱️ Auth timeout');
                doResolve(null);
            }, 10000);
        });
    },

    // Fallback user doc when Firestore is unavailable
    makeFallbackDoc(user) {
        return {
            id: user.uid,
            email: user.email,
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            role: user.email.toLowerCase() === window.OWNER_EMAIL.toLowerCase() ? 'owner' : 'pending',
            status: 'active'
        };
    },

    // Create or update user document in Firestore
    async ensureUserDoc(user) {
        const userRef = window.db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            const isOwner = user.email.toLowerCase() === window.OWNER_EMAIL.toLowerCase();
            const userData = {
                email: user.email,
                displayName: user.displayName || '',
                photoURL: user.photoURL || '',
                role: isOwner ? 'owner' : 'pending',
                status: 'active',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };
            await userRef.set(userData);
            this.currentUserDoc = { id: user.uid, ...userData };
        } else {
            try {
                await userRef.update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                    displayName: user.displayName || userDoc.data().displayName,
                    photoURL: user.photoURL || userDoc.data().photoURL
                });
            } catch(e) { console.warn('Update lastLogin:', e); }
            this.currentUserDoc = { id: user.uid, ...userDoc.data() };
        }
    },

    // Sign in with Google
    async signInWithGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await window.auth.signInWithRedirect(provider);
    },

    // Sign out
    async signOut() { await window.auth.signOut(); },

    // Role checks
    hasRole(role) { return this.currentUserDoc && this.currentUserDoc.role === role; },
    isOwner() { return this.hasRole('owner'); },
    isTeacher() { return this.hasRole('teacher'); },
    isStaff() { return this.hasRole('staff'); },
    isPending() { return this.hasRole('pending'); },
    hasAnyRole(...roles) { return this.currentUserDoc && roles.includes(this.currentUserDoc.role); },

    getRoleDisplay(role) {
        const map = { 'owner': 'Chủ trung tâm', 'teacher': 'Giáo viên', 'staff': 'Học vụ', 'pending': 'Chờ duyệt' };
        return map[role] || role;
    },

    onAuthChange(cb) { this.listeners.push(cb); },
    notifyListeners() { this.listeners.forEach(cb => cb(this.currentUser, this.currentUserDoc)); }
};

window.Auth = Auth;
