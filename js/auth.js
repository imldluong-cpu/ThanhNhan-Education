// ============================================
// AUTHENTICATION MODULE
// ============================================

const Auth = {
    currentUser: null,
    currentUserDoc: null,
    listeners: [],

    // Initialize auth state listener
    init() {
        return new Promise((resolve) => {
            // Handle redirect result first
            window.auth.getRedirectResult().then((result) => {
                if (result && result.user) {
                    console.log('✅ Redirect sign-in successful:', result.user.email);
                }
            }).catch((error) => {
                console.warn('Redirect result error (can be ignored):', error.message);
            });

            // Listen for auth state changes
            window.auth.onAuthStateChanged(async (user) => {
                console.log('🔄 Auth state changed:', user ? user.email : 'No user');
                if (user) {
                    this.currentUser = user;
                    try {
                        await this.ensureUserDoc(user);
                    } catch (error) {
                        console.error('❌ Error setting up user doc:', error);
                        // Still set basic user info even if Firestore fails
                        this.currentUserDoc = {
                            id: user.uid,
                            email: user.email,
                            displayName: user.displayName || '',
                            photoURL: user.photoURL || '',
                            role: user.email.toLowerCase() === window.OWNER_EMAIL.toLowerCase() ? 'owner' : 'pending',
                            status: 'active'
                        };
                    }
                    window.currentUser = this.currentUserDoc;
                } else {
                    this.currentUser = null;
                    this.currentUserDoc = null;
                    window.currentUser = null;
                }
                this.notifyListeners();
                resolve(user);
            });

            // Timeout safety - don't let loading screen hang forever
            setTimeout(() => {
                console.warn('⏱️ Auth timeout - resolving anyway');
                resolve(null);
            }, 8000);
        });
    },

    // Create or update user document in Firestore
    async ensureUserDoc(user) {
        const userRef = window.db.collection('users').doc(user.uid);
        
        let userDoc;
        try {
            userDoc = await userRef.get();
        } catch (error) {
            console.error('Firestore get error:', error);
            throw error;
        }
        
        if (!userDoc.exists) {
            // New user - determine role
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
            console.log('✅ New user created:', userData.role);
        } else {
            // Existing user - update last login
            try {
                await userRef.update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                    displayName: user.displayName || userDoc.data().displayName,
                    photoURL: user.photoURL || userDoc.data().photoURL
                });
            } catch (e) {
                console.warn('Could not update lastLogin:', e);
            }
            this.currentUserDoc = { id: user.uid, ...userDoc.data() };
            console.log('✅ Existing user loaded:', this.currentUserDoc.role);
        }
    },

    // Sign in with Google (redirect method - works on GitHub Pages)
    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({
                prompt: 'select_account'
            });
            // Use redirect instead of popup to avoid COOP issues
            await window.auth.signInWithRedirect(provider);
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    // Sign out
    async signOut() {
        try {
            await window.auth.signOut();
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    },

    // Check role
    hasRole(role) {
        return this.currentUserDoc && this.currentUserDoc.role === role;
    },

    isOwner() {
        return this.hasRole('owner');
    },

    isTeacher() {
        return this.hasRole('teacher');
    },

    isStaff() {
        return this.hasRole('staff');
    },

    isPending() {
        return this.hasRole('pending');
    },

    hasAnyRole(...roles) {
        return this.currentUserDoc && roles.includes(this.currentUserDoc.role);
    },

    // Role display names in Vietnamese
    getRoleDisplay(role) {
        const roles = {
            'owner': 'Chủ trung tâm',
            'teacher': 'Giáo viên',
            'staff': 'Học vụ',
            'pending': 'Chờ duyệt'
        };
        return roles[role] || role;
    },

    // Subscribe to auth changes
    onAuthChange(callback) {
        this.listeners.push(callback);
    },

    notifyListeners() {
        this.listeners.forEach(cb => cb(this.currentUser, this.currentUserDoc));
    }
};

window.Auth = Auth;
