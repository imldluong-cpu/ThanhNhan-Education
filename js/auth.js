// ============================================
// AUTHENTICATION MODULE
// ============================================

const Auth = {
    currentUser: null,
    currentUserDoc: null,
    listeners: [],

    init() {
        return new Promise((resolve) => {
            let resolved = false;
            const doResolve = (user) => {
                if (!resolved) { resolved = true; resolve(user); }
            };

            window.auth.onAuthStateChanged(async (user) => {
                console.log('🔄 Auth state:', user ? user.email : 'signed out');
                if (user) {
                    this.currentUser = user;
                    try {
                        await this.ensureUserDoc(user);
                    } catch(e) {
                        console.warn('Firestore error, using fallback:', e);
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
                doResolve(user);
            });

            setTimeout(() => { doResolve(null); }, 10000);
        });
    },

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
            } catch(e) { console.warn('Update login:', e); }
            this.currentUserDoc = { id: user.uid, ...userDoc.data() };
        }
    },

    // Sign in with Google - POPUP method
    async signInWithGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await window.auth.signInWithPopup(provider);
        return result.user;
    },

    async signOut() { await window.auth.signOut(); },

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
