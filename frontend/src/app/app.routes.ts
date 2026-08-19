import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { homeRedirectGuard } from './core/guards/home-redirect.guard';
import { featureEnabledGuard, loadFeaturesGuard } from './core/guards/feature-access.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth/callback/auth-callback.component').then((m) => m.AuthCallbackComponent)
  },
  {
    path: 'profile',
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        title: 'Profile',
        loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent)
      }
    ]
  },
  {
    path: 'admin',
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard, roleGuard('SOCIETY_ADMIN'), loadFeaturesGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'members',
        title: 'Members',
        canActivate: [featureEnabledGuard('MEMBERS')],
        loadComponent: () => import('./features/member-list/member-list.component').then((m) => m.MemberListComponent)
      },
      {
        path: 'notices',
        title: 'Notices',
        canActivate: [featureEnabledGuard('NOTICES')],
        loadComponent: () => import('./features/notice-list/notice-list.component').then((m) => m.NoticeListComponent)
      },
      {
        path: 'documents',
        title: 'Documents',
        canActivate: [featureEnabledGuard('DOCUMENTS')],
        loadComponent: () => import('./features/document-list/document-list.component').then((m) => m.DocumentListComponent)
      },
      {
        path: 'forms',
        title: 'Forms',
        canActivate: [featureEnabledGuard('FORMS')],
        loadComponent: () => import('./features/form-list/form-list.component').then((m) => m.FormListComponent)
      },
      {
        path: 'committee',
        title: 'Committee',
        canActivate: [featureEnabledGuard('COMMITTEE')],
        loadComponent: () => import('./features/committee-list/committee-list.component').then((m) => m.CommitteeListComponent)
      },
      {
        path: 'meetings',
        title: 'Meetings',
        canActivate: [featureEnabledGuard('MEETINGS')],
        loadComponent: () => import('./features/meeting-list/meeting-list.component').then((m) => m.MeetingListComponent)
      },
      {
        path: 'gallery',
        title: 'Gallery',
        canActivate: [featureEnabledGuard('GALLERY')],
        loadComponent: () => import('./features/gallery-list/gallery-list.component').then((m) => m.GalleryListComponent)
      },
      {
        path: 'events',
        title: 'Events',
        canActivate: [featureEnabledGuard('EVENTS')],
        loadComponent: () => import('./features/event-list/event-list.component').then((m) => m.EventListComponent)
      },
      {
        path: 'categories',
        title: 'Categories',
        loadComponent: () => import('./features/category-management/category-management.component').then((m) => m.CategoryManagementComponent)
      }
    ]
  },
  {
    path: 'member',
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard, roleGuard('MEMBER'), loadFeaturesGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () =>
          import('./features/member-portal/member-home/member-home.component').then((m) => m.MemberHomeComponent)
      },
      {
        path: 'notices',
        title: 'Notices',
        canActivate: [featureEnabledGuard('NOTICES')],
        loadComponent: () =>
          import('./features/member-portal/my-notices/my-notices.component').then((m) => m.MyNoticesComponent)
      },
      {
        path: 'documents',
        title: 'Documents',
        canActivate: [featureEnabledGuard('DOCUMENTS')],
        loadComponent: () =>
          import('./features/member-portal/my-documents/my-documents.component').then((m) => m.MyDocumentsComponent)
      },
      {
        path: 'forms',
        title: 'Forms',
        canActivate: [featureEnabledGuard('FORMS')],
        loadComponent: () =>
          import('./features/member-portal/my-forms/my-forms.component').then((m) => m.MyFormsComponent)
      },
      {
        path: 'committee',
        title: 'Committee',
        canActivate: [featureEnabledGuard('COMMITTEE')],
        loadComponent: () =>
          import('./features/member-portal/my-committee/my-committee.component').then((m) => m.MyCommitteeComponent)
      },
      {
        path: 'meetings',
        title: 'Meetings',
        canActivate: [featureEnabledGuard('MEETINGS')],
        loadComponent: () =>
          import('./features/member-portal/my-meetings/my-meetings.component').then((m) => m.MyMeetingsComponent)
      },
      {
        path: 'gallery',
        title: 'Gallery',
        canActivate: [featureEnabledGuard('GALLERY')],
        loadComponent: () =>
          import('./features/member-portal/my-gallery/my-gallery.component').then((m) => m.MyGalleryComponent)
      },
      {
        path: 'events',
        title: 'Events',
        canActivate: [featureEnabledGuard('EVENTS')],
        loadComponent: () =>
          import('./features/member-portal/my-events/my-events.component').then((m) => m.MyEventsComponent)
      }
    ]
  },
  {
    path: 'super-admin',
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard, roleGuard('SUPER_ADMIN')],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () =>
          import('./features/super-admin/dashboard/super-admin-dashboard.component').then((m) => m.SuperAdminDashboardComponent)
      },
      {
        path: 'societies',
        title: 'Societies',
        loadComponent: () =>
          import('./features/super-admin/society-list/society-list.component').then((m) => m.SocietyListComponent)
      },
      {
        path: 'societies/:societyId',
        title: 'Society Detail',
        loadComponent: () =>
          import('./features/super-admin/society-detail/society-detail.component').then((m) => m.SocietyDetailComponent)
      }
    ]
  },
  { path: '', pathMatch: 'full', canActivate: [homeRedirectGuard], children: [] },
  { path: '**', redirectTo: '' }
];
