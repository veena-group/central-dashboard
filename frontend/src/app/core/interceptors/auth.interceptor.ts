import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  const authorizedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  const isAuthEndpoint = req.url.includes('/auth/login') || req.url.includes('/auth/logout');

  return next(authorizedReq).pipe(
    catchError((error) => {
      // Skip login/logout requests: a 401 there means "bad credentials" or "already logged out",
      // not "session expired" - calling logout() for them would just repeat the same request
      // (logout has no valid token to attach) and loop forever on its own 401.
      if (error.status === 401 && !isAuthEndpoint) {
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};
