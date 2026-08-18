import { IconName } from '../shared/icon/icon.component';
import { Role } from '../core/models/auth.model';
import { FeatureKey } from '../core/services/feature-access.service';

export interface NavItem {
  label: string;
  route: string;
  icon: IconName;
  featureKey?: FeatureKey;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', route: '/admin/dashboard', icon: 'dashboard' }
    ]
  },
  {
    title: 'Society Content',
    items: [
      { label: 'Members', route: '/admin/members', icon: 'members', featureKey: 'MEMBERS' },
      { label: 'Notices', route: '/admin/notices', icon: 'notices', featureKey: 'NOTICES' },
      { label: 'Documents', route: '/admin/documents', icon: 'documents', featureKey: 'DOCUMENTS' },
      { label: 'Forms', route: '/admin/forms', icon: 'forms', featureKey: 'FORMS' },
      { label: 'Committee', route: '/admin/committee', icon: 'committee', featureKey: 'COMMITTEE' },
      { label: 'Meetings', route: '/admin/meetings', icon: 'meetings', featureKey: 'MEETINGS' },
      { label: 'Gallery', route: '/admin/gallery', icon: 'gallery', featureKey: 'GALLERY' },
      { label: 'Events', route: '/admin/events', icon: 'events', featureKey: 'EVENTS' },
      { label: 'Categories', route: '/admin/categories', icon: 'categories' }
    ]
  }
];

const MEMBER_NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', route: '/member/dashboard', icon: 'dashboard' }
    ]
  },
  {
    title: 'Society Content',
    items: [
      { label: 'Notices', route: '/member/notices', icon: 'notices', featureKey: 'NOTICES' },
      { label: 'Documents', route: '/member/documents', icon: 'documents', featureKey: 'DOCUMENTS' },
      { label: 'Forms', route: '/member/forms', icon: 'forms', featureKey: 'FORMS' },
      { label: 'Committee', route: '/member/committee', icon: 'committee', featureKey: 'COMMITTEE' },
      { label: 'Meetings', route: '/member/meetings', icon: 'meetings', featureKey: 'MEETINGS' },
      { label: 'Gallery', route: '/member/gallery', icon: 'gallery', featureKey: 'GALLERY' },
      { label: 'Events', route: '/member/events', icon: 'events', featureKey: 'EVENTS' }
    ]
  }
];

const SUPER_ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    title: 'Platform',
    items: [
      { label: 'Dashboard', route: '/super-admin/dashboard', icon: 'dashboard' },
      { label: 'Societies', route: '/super-admin/societies', icon: 'building' }
    ]
  }
];

const NAV_GROUPS_BY_ROLE: Record<Role, NavGroup[]> = {
  SOCIETY_ADMIN: ADMIN_NAV_GROUPS,
  MEMBER: MEMBER_NAV_GROUPS,
  SUPER_ADMIN: SUPER_ADMIN_NAV_GROUPS
};

export function getNavGroups(role: Role | undefined): NavGroup[] {
  return role ? NAV_GROUPS_BY_ROLE[role] : [];
}
