/// <reference path="../scripts/typings/angularjs/angular.d.ts" />
angular.module('identityHub', []);
angular.module('identityHub').provider('identityService', function identityServiceProvider() {
  var _this = this;
  var errors = [];
  this.init = function (parameters) {
    _this.oauthParameters = parameters;
  };
  this.$get = [
    '$http',
    '$q',
    '$interval',
    function identityServiceFactory($http, $q, $interval) {
      var _this = this;
      var errors = [];
      var self = this;
      var service = {
          signIn: function (state) {
            var url = _this.oauthParameters.baseUrl + '/oauth2/v1/auth' + '?response_type=token' + '&client_id=' + encodeURIComponent(_this.oauthParameters.clientId) + '&redirect_uri=' + encodeURIComponent(_this.oauthParameters.redirectUri);
            if (_this.oauthParameters.scopes !== undefined) {
              url += '&scope=' + encodeURIComponent(_this.oauthParameters.scopes);
            }
            if (state && state !== '') {
              url += '&state=' + encodeURIComponent(state);
            } else {
              url += '&state=' + encodeURIComponent(window.location.hash);
            }
            if (_this.oauthParameters.popup) {
              var left = window.screenX + (window.outerWidth - 600) / 2;
              var top = window.screenY + (window.outerHeight - 400) / 2;
              var windowOptions = 'status=0,resizable=0,location=0,toolbar=0,menubar=0,titlebar=0,left=' + left + ',top=' + top + ',height=400px,width=600px';
              var win = window.open(url, null, windowOptions);
              var check = $interval(function () {
                  var hash;
                  try {
                    if (win.location.href.indexOf(self.oauthParameters.redirectUri) >= 0) {
                      hash = win.location.hash;
                      setTimeout(function () {
                        self.parseResponse(hash);
                      }, 1000);
                      win.close();
                      win = null;
                      $interval.cancel(check);
                    }
                  } catch (ex) {
                  }
                }, 1000);
            } else {
              window.location.href = url;
            }
          },
          getProfile: function () {
            var deferred = $q.defer();
            var token = _this.getToken();
            $http.get(_this.oauthParameters.baseUrl + '/api/identity/v1/', { headers: { 'Authorization': 'Bearer ' + token.access_token } }).success(function (response) {
              service.principal.identity = response;
              deferred.resolve(response);
            }).error(function (error) {
              deferred.reject(error);
            });
            return deferred.promise;
          },
          getFriends: function () {
            var deferred = $q.defer();
            var token = _this.getToken();
            $http.get(_this.oauthParameters.baseUrl + '/api/identity/v1/friends', { headers: { 'Authorization': 'Bearer ' + token.access_token } }).success(function (response) {
              deferred.resolve(response);
            }).error(function (error) {
              deferred.reject(error);
            });
            return deferred.promise;
          },
          principal: {
            isAuthenticated: false,
            token: null,
            identity: null
          }
        };
      this.getToken = function () {
        if (service.principal && service.principal !== undefined) {
          var token = service.principal.token;
          var today = new Date().getTime();
          if (token && token.access_token && token.expiry > today) {
            return token;
          } else {
            service.principal.token = null;
            service.principal.isAuthenticated = false;
          }
        }
        if (!_this.oauthParameters.manualSignIn) {
          service.signIn();
        }
      };
      this.setToken = function (responseParams) {
        if (responseParams && responseParams.access_token && responseParams.access_token !== '') {
          service.principal.token = {
            access_token: responseParams.access_token,
            expiry: new Date().getTime() + responseParams.expires_in * 1000,
            scope: responseParams.scope
          };
          service.principal.isAuthenticated = true;
        }
        return null;
      };
      this.parseResponse = function (url, callback) {
        var token, parameters;
        if (!url || url === '') {
          url = window.location.hash;
        }
        if (url && url !== '') {
          parameters = getQueryParameters(url);
          _this.setToken(parameters);
          if (service.principal.isAuthenticated) {
            service.getProfile();
            if (callback) {
              callback(parameters);
            }
            var state = parameters.state;
            if (state && state !== '') {
              window.location.hash = state;
            } else {
              window.location.hash = '';
            }
            return;
          }
        }
        if (!_this.oauthParameters.manualSignIn) {
          service.signIn();
        }
      };
      function getQueryParameters(query) {
        if (query[0] === '?' || query[0] === '#') {
          query = query.substr(1, query.length - 1);
        }
        if (query[0] === '/') {
          query = query.substr(1, query.length - 1);
        }
        var params = query.split('&');
        var result = [];
        if (params && params.length > 0) {
          for (var i = 0; i < params.length; i++) {
            var values = params[i].split('=');
            if (values.length === 2) {
              result[values[0]] = decodeURIComponent(values[1]);
            }
          }
        }
        return result;
      }
      errors['invalid_request'] = 'The request is missing a required parameter, includes an invalid parameter value, includes a parameter more than once, or is otherwise malformed.';
      errors['invalid_client'] = 'Invalid client';
      errors['invalid_grant'] = 'Invalid grant';
      errors['invalid_token'] = 'The token is invlaid.';
      errors['unauthorized_client'] = 'The client is not authorized to request an access token using this method.';
      errors['unsupported_grant_type'] = 'Unsupported grant type.';
      errors['unsupported_response_type'] = 'The authorization server does not support obtaining an access token using this method.';
      errors['invalid_scope'] = 'The requested scope is invalid, unknown, or malformed.';
      errors['access_denied'] = 'The resource owner or authorization server denied the request.';
      errors['server_error'] = 'The authorization server encountered an unexpected condition that prevented it from fulfilling the request. (This error code is needed because a 500 Internal Server Error HTTP status code cannot be returned to the client via an HTTP redirect.)';
      errors['unsupported_token_type'] = 'The authorization server does not support the revocation of the presented token type.  That is, the client tried to revoke an access token on a server not supporting this feature.';
      this.parseResponse();
      return service;
    }
  ];
  return this;
});  //# sourceMappingURL=identityService.js.map
