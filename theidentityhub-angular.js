/// <reference path="../scripts/typings/angularjs/angular.d.ts" />

angular.module("identityHub", []);

angular.module("identityHub").provider("identityService", function identityServiceProvider() {
    var _this = this;
    var errors = [];

    this.config = function (parameters) {
        _this.oauthParameters = parameters;
        var baseUrl = _this.oauthParameters.baseUrl;
        if (typeof baseUrl !== "string") {
            throw { error: "The baseUrl is required." };
        }

        baseUrl = baseUrl.trim();
        if (baseUrl[baseUrl.length - 1] === '/') {
            baseUrl = baseUrl.substring(0, baseUrl.length - 1);
        }

        _this.oauthParameters.baseUrl = baseUrl;
    };

    this.$get = [
        '$http', '$q', '$interval', '$window', function identityServiceFactory($http, $q, $interval, $window) {
            var _this = this;
            var errors = [];
            var self = this;
            var service = {
                signIn: function (state) {
                    var deferred = $q.defer();
                    var url = _this.oauthParameters.baseUrl + "/oauth2/v1/auth" + "?response_type=token" + "&client_id=" + encodeURIComponent(_this.oauthParameters.clientId) + "&redirect_uri=" + encodeURIComponent(_this.oauthParameters.redirectUri);

                    if (_this.oauthParameters.scopes !== undefined) {
                        url += "&scope=" + encodeURIComponent(_this.oauthParameters.scopes);
                    }

                    if (state && state !== "") {
                        url += "&state=" + encodeURIComponent(state);
                    } else {
                        url += "&state=" + encodeURIComponent($window.location.hash);
                    }

                    if (_this.oauthParameters.popup) {
                        _this.authenticationBroker({
                            "url": url,
                            "redirectUri": self.oauthParameters.redirectUri,
                            "width": 600,
                            "height": 500
                        }).then(function (response) {
                            self.parseResponse(response.hash);
                            deferred.resolve();
                        });
                    } else {
                        $window.location.href = url;
                        deferred.resolve();
                    }

                    return deferred.promise;
                },
                signOut: function () {
                    var deferred = $q.defer();
                    var token = _this.getToken();

                    sessionStorage.removeItem("access_token");
                    service.principal.isAuthenticated = false;
                    service.principal.isVerified = false;
                    service.principal.identity = null;

                    $http({
                        method: "POST",
                        url: _this.oauthParameters.baseUrl + "/oauth2/v1/revoke",
                        data: $.param({
                            "token": token.access_token,
                            "token_type_hint": "access_token",
                            "client_id": _this.oauthParameters.clientId
                        }),
                        headers: { "Content-Type": "application/x-www-form-urlencoded" }
                    }).success(function (response) {
                        deferred.resolve(response);
                    }).error(function (error) {
                        deferred.reject(error);
                    });

                    return deferred.promise;
                },
                getProfile: function () {
                    var deferred = $q.defer();
                    var token = _this.getToken();

                    $http.get(_this.oauthParameters.baseUrl + "/api/identity/v1/", {
                        headers: {
                            "Authorization": "Bearer " + token.access_token
                        }
                    }).success(function (response) {
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

                    $http.get(_this.oauthParameters.baseUrl + "/api/identity/v1/friends", {
                        headers: {
                            "Authorization": "Bearer " + token.access_token
                        }
                    }).success(function (response) {
                        deferred.resolve(response);
                    }).error(function (error) {
                        deferred.reject(error);
                    });

                    return deferred.promise;
                },
                getRoles: function () {
                    var deferred = $q.defer();
                    var token = _this.getToken();

                    $http.get(_this.oauthParameters.baseUrl + "/api/identity/v1/roles", {
                        headers: {
                            "Authorization": "Bearer " + token.access_token
                        }
                    }).success(function (response) {
                        service.principal.roles = response;
                        deferred.resolve(response);
                    }).error(function (error) {
                        deferred.reject(error);
                    });

                    return deferred.promise;
                },
                getAccounts: function () {
                    var deferred = $q.defer();
                    var token = _this.getToken();

                    $http.get(_this.oauthParameters.baseUrl + "/api/identity/v1/accounts", {
                        headers: {
                            "Authorization": "Bearer " + token.access_token
                        }
                    }).success(function (response) {
                        deferred.resolve(response);
                    }).error(function (error) {
                        deferred.reject(error);
                    });

                    return deferred.promise;
                },
                requireTwoFactorAuthentication: function () {
                    var deferred = $q.defer();
                    var token = _this.getToken();

                    if (service.principal.isVerified) {
                        deferred.resolve(true);
                        return deferred.promise;
                    }

                    $http.get(_this.oauthParameters.baseUrl + "/oauth2/v1/verify", {
                        headers: { "Authorization": "Bearer " + token.access_token }
                    }).success(function (response) {
                        if (response && response.resource_owner_identity_verified) {
                            service.principal.isVerified = true;
                            deferred.resolve(true);
                        } else {
                            var requestUri = _this.oauthParameters.baseUrl + "/Authenticate/PerformTwoFactorAuthenticationVerification?accessToken=" + token.access_token + "&clientId=" + _this.oauthParameters.clientId + "&returnUrl=" + encodeURIComponent(_this.oauthParameters.redirectUri);

                            _this.authenticationBroker({
                                "url": requestUri,
                                "redirectUri": _this.oauthParameters.redirectUri,
                                "width": 600,
                                "height": 500
                            }).then(function (response) {
                                var property = "resource_owner_identity_verified=";
                                var pos = response.href.indexOf(property);
                                if (pos != -1 && response.href.length >= pos + (property.length + 1)) {
                                    var isVerified = response.href[pos + property.length] == '1';
                                    service.principal.isVerified = isVerified;
                                    deferred.resolve(isVerified);
                                } else {
                                    deferred.resolve(false);
                                }
                            });
                        }
                    }).error(function (error) {
                        deferred.reject(error);
                    });

                    return deferred.promise;
                },
                addAccount: function (accountProvider) {
                    var deferred = $q.defer();
                    var token = _this.getToken();

                    _this.authenticationBroker({
                        "url": accountProvider.signInUrl + "?access_token=" + token.access_token + "&returnurl=" + encodeURIComponent(_this.oauthParameters.redirectUri),
                        "redirectUri": _this.oauthParameters.redirectUri,
                        "width": 600,
                        "height": 500
                    }).then(function (response) {
                        deferred.resolve();
                    });

                    return deferred.promise;
                },
                principal: {
                    isAuthenticated: false,
                    isVerified: false,
                    token: null,
                    identity: null,
                    roles: [],
                    isInRole: function (role) {
                        var found = false;
                        $.each(service.principal.roles, function (index, element) {
                            found = (element.name === role);
                            return !found;
                        });

                        return found;
                    }
                }
            };

            this.authenticationBroker = function (options) {
                var deferred = $q.defer();
                var left = $window.screenX + ($window.outerWidth - options.width) / 2;
                var top = $window.screenY + ($window.outerHeight - options.height) / 2;

                var windowOptions = "status=0,resizable=0,scrollbars=1,location=0,toolbar=0,menubar=0,titlebar=0" + ",left= " + left + ",top=" + top + ",height=" + options.height + ",width=" + options.width;

                var brokerWindow = $window.open(options.url, "Authenticate", windowOptions);

                var check = $interval(function () {
                    try {
                        if (brokerWindow.location.href.indexOf(options.redirectUri) >= 0) {
                            var response = {
                                href: brokerWindow.location.href,
                                hash: brokerWindow.location.hash,
                                search: brokerWindow.location.search
                            };

                            setTimeout(function () {
                                deferred.resolve(response);
                            }, 1000);

                            brokerWindow.close();
                            brokerWindow = null;
                            $interval.cancel(check);
                        }
                    } catch (ex) {
                    }
                }, 1000);

                return deferred.promise;
            };

            this.getToken = function () {
                var token;
                var today = new Date().getTime();

                if (service.principal && service.principal !== undefined && service.principal.token && service.principal.token !== undefined) {
                    token = service.principal.token;
                    if (token && token.access_token && token.expiry > today) {
                        return token;
                    }
                } else {
                    token = JSON.parse(sessionStorage.getItem("access_token"));
                    if (token && token.access_token && token.expiry > today) {
                        return token;
                    }
                }

                service.principal.token = null;
                service.principal.roles = [];
                service.principal.isAuthenticated = false;
                sessionStorage.removeItem("access_token");

                if (!_this.oauthParameters.manualSignIn) {
                    service.signIn();
                }
            };

            this.setToken = function (responseParams) {
                if (responseParams && responseParams.access_token && responseParams.access_token !== "") {
                    service.principal.token = {
                        access_token: responseParams.access_token,
                        expiry: new Date().getTime() + responseParams.expires_in * 1000,
                        scope: responseParams.scope
                    };

                    service.principal.isAuthenticated = true;
                    service.principal.isVerified = responseParams.resource_owner_identity_verified === '1';

                    sessionStorage.setItem("access_token", JSON.stringify(service.principal.token));
                }

                return null;
            };

            this.parseResponse = function (hash) {
                var token, parameters;

                if (!hash || hash === "") {
                    hash = window.location.hash;
                }

                if (hash && hash !== "") {
                    parameters = getQueryParameters(hash);
                    _this.setToken(parameters);
                    if (service.principal.isAuthenticated) {
                        service.getProfile();
                        service.getRoles();

                        var state = parameters.state;
                        if (state && state !== "") {
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
                if (query[0] === "?" || query[0] === "#") {
                    query = query.substr(1, query.length - 1);
                }

                if (query[0] === "/") {
                    query = query.substr(1, query.length - 1);
                }

                var params = query.split("&");
                var result = [];
                if (params && params.length > 0) {
                    for (var i = 0; i < params.length; i++) {
                        var values = params[i].split("=");
                        if (values.length === 2) {
                            result[values[0]] = decodeURIComponent(values[1]);
                        }
                    }
                }

                return result;
            }

            errors["invalid_request"] = "The request is missing a required parameter, includes an invalid parameter value, includes a parameter more than once, or is otherwise malformed.";
            errors["invalid_client"] = "Invalid client";
            errors["invalid_grant"] = "Invalid grant";
            errors["invalid_token"] = "The token is invlaid.";
            errors["unauthorized_client"] = "The client is not authorized to request an access token using this method.";
            errors["unsupported_grant_type"] = "Unsupported grant type.";
            errors["unsupported_response_type"] = "The authorization server does not support obtaining an access token using this method.";
            errors["invalid_scope"] = "The requested scope is invalid, unknown, or malformed.";
            errors["access_denied"] = "The resource owner or authorization server denied the request.";
            errors["server_error"] = "The authorization server encountered an unexpected condition that prevented it from fulfilling the request. (This error code is needed because a 500 Internal Server Error HTTP status code cannot be returned to the client via an HTTP redirect.)";
            errors["unsupported_token_type"] = "The authorization server does not support the revocation of the presented token type.  That is, the client tried to revoke an access token on a server not supporting this feature.";

            this.parseResponse();

            return service;
        }];

    return this;
});
//# sourceMappingURL=identityService.js.map