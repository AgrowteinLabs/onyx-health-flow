export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://api.onyxhealthplus.com';
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    // User auth
    USER_AUTH: '/api/auth/auth',
    USER_AUTH_VERIFY: '/api/auth/auth-verify',
    
    // Super Admin
    CREATE_SUPER_ADMIN: '/api/auth/create/super-admin',
    VERIFY_SUPER_ADMIN: '/api/auth/create/verify-super-admin',
    
    // Executive Admin
    CREATE_EXEC_ADMIN: '/api/auth/create/exec-admin',
    VERIFY_EXEC_ADMIN: '/api/auth/create/verify-exec-admin',
    
    // Cluster Head
    CREATE_CLUSTER_HEAD: '/api/auth/create/cluster-head',
    VERIFY_CLUSTER_HEAD: '/api/auth/create/verify-cluster-head',
    
    // User Head
    CREATE_USER_HEAD: '/api/auth/create/user-head',
    VERIFY_USER_HEAD: '/api/auth/create/verify-user-head',
    
    // Nurse
    CREATE_NURSE: '/api/auth/create/nurse',
    VERIFY_NURSE: '/api/auth/create/verify-nurse',
    
    // Technician
    CREATE_TECHNICIAN: '/api/auth/create/technician',
    VERIFY_TECHNICIAN: '/api/auth/create/verify-technician',
    
    // Non-User
    SIGNIN_NON_USER: '/api/auth/signin-non-user',
    VERIFY_NON_USER: '/api/auth/verify-non-user',
    
    // Password Reset
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
    
    // Token
    ISSUE_TOKEN: '/api/auth/issue-token',

    REFRESH_TOKEN: '/api/auth/refresh-token',
    LOGOUT: '/api/auth/logout',
    RESEND_OTP: '/api/auth/resend-otp',
  },
  
  // Profile endpoints
  PROFILE: {
    CREATE: '/create/profile',
    GET_ALL: '/get/profile',
    VIEW: (id: string) => `/view/profile/${id}`,
    UPDATE: (id: string) => `/update/profile/${id}`,
    DELETE: (id: string) => `/delete/profile/${id}`,
  },
  
  // Session endpoints
  SESSION: {
    CREATE: '/api/session/create',
    GET_ALL: '/api/session/sessionDetails',
    VIEW: (id: string) => `/api/session/view/${id}`,
    UPDATE: (id: string) => `/api/session/update/session/${id}`,
    DELETE: (id: string) => `/api/session/delete/session/${id}`,
  },
  
  // Session Item endpoints
  SESSION_ITEM: {
    ADD_RESULT: '/add/session-items-result',
    ADD_MEDIA: '/add/session-items-media',
    GET_MEDIA: (id: string, fileKey: string) => `/session-items/${id}/media/${fileKey}`,
    LIST_BY_SESSION: (sessionId: string) => `/sessions/${sessionId}/items`,
    VIEW: (id: string) => `/session-items/${id}`,
    VIEW_URLS: (id: string) => `/session-items/${id}/view-urls`,
    LIST_MEDIA: (id: string) => `/session-items/${id}/media`,
    GET_MEDIA_INDEX: (id: string, index: number) => `/session-items/${id}/media/${index}`,
  },
  
  // Test endpoints
  TEST: {
    ADD: '/api/test/add-test',
    LIST: '/api/test/list-tests',
  },
  
  // Model endpoints
  MODEL: {
    ADD: '/api/model/add-model',
  },
  
  // Product endpoints
  PRODUCT: {
    ADD: '/api/product/add-product',
    GET_TESTS: (deviceCode: string) => `/api/product/product-tests/${deviceCode}`,
  },
  
  // User endpoints
  USER: {
    VIEW: '/view/user',
    UPDATE: (id: string) => `/update/user/${id}`,
    DELETE: '/api/user/delete',
  },
  
  // Organization endpoints
  ORGANIZATION: {
    CREATE: '/api/create/organization',
    LIST: '/api/list/organizations',
    VIEW: (id: string) => `/api/view/organization/${id}`,
    DELETE: (id: string) => `/api/delete/organization/${id}`,
  },
  
  // Linked Accounts endpoints
  LINKED_ACCOUNTS: {
    CREATE: '/create/linked-accounts',
    LIST: '/list/linked-accounts',
    VIEW: (id: string) => `/view/linked-accounts/${id}`,
    UPDATE: (id: string) => `/update/linked-accounts/${id}`,
    UPDATE_BANK: (id: string) => `/update/linked-accounts/${id}/bank`,
    DELETE: (id: string) => `/delete/linked-accounts/${id}`,
    VALIDATE: '/validate/linked-accounts',
    ONBOARD_START: '/onboard/start',
    ONBOARD_CALLBACK: '/onboard/callback',
  },
  
  // Orders endpoints
  ORDER: {
    CREATE: '/create/order',
    LIST: '/list/orders',
  },
  
  // Report endpoints
  REPORT: {
    ADD: '/api/report/add',
    GET_ALL: '/api/report/all',
    BY_PROFILE: (id: string) => `/api/report/byProfile/${id}`,
    BY_USER: (id: string) => `/api/report/byUser/${id}`,
    BY_SESSION: (id: string) => `/api/report/bySession/${id}`,
    BY_ORGANIZATION: (id: string) => `/api/report/byOrganization/${id}`,
    BY_NURSE: (id: string) => `/api/report/byNurse/${id}`,
    CLUSTER_HEAD: (id: string) => `/report/cluster_head/${id}`,
  },
  
  // Doctor endpoints
  DOCTOR: {
    CREATE_ADMIN: '/api/doctor/admin/create',
    APPROVE_ADMIN: '/api/doctor/admin/approve',
    CREATE: '/api/doctor/create',
    LIST: '/api/doctor/list',
    AVAILABILITY: '/api/doctor/availability',
  },
  
  // Booking endpoints
  BOOKING: {
    CREATE: '/api/booking/create',
    CONFIRM: '/api/booking/confirm',
    LIST: '/api/booking/list',
  },
  
  // Ticket endpoints
  TICKET: {
    CREATE: '/api/ticket/create',
    ADMIN_LIST: '/api/ticket/admin/list',
    ADMIN_RESOLVE: (id: string) => `/api/ticket/admin/resolve/${id}`,
  },

  // Video endpoints
  VIDEO: {
    TOKEN: (bookingId: string) => `/api/video/token/${bookingId}`,
  }
};
