﻿import $ from "jquery";
import ko from "knockout";
import system from "../core/system";
import app from "../core/app";
import activator from "../core/activator";
import events from "../core/events";
import composition from "../core/composition";
import history from "./history";

/**
 * Connects the history module's url and history tracking support to Durandal's activation and composition engine allowing you to easily build navigation-style applications.
 * @module router
 * @requires jquery
 * @requires knockout
 * @requires system
 * @requires app
 * @requires activator
 * @requires events
 * @requires composition
 * @requires history
 */
function RouterModule() {
    const optionalParam = /\((.*?)\)/g;
    const namedParam = /(\(\?)?:\w+/g;
    const splatParam = /\*\w+/g;
    const escapeRegExp = /[\-{}\[\]+?.,\\\^$|#\s]/g;
    let startDeferred;
    let rootRouter;
    const trailingSlash = /\/$/;
    let routesAreCaseSensitive = false;
    let lastUrl = "/";
    let lastTryUrl = "/";

    function routeStringToRegExp(routeString) {
        routeString = routeString
            .replace(escapeRegExp, "\\$&")
            .replace(optionalParam, "(?:$1)?")
            .replace(namedParam, (match, optional) => (optional ? match : "([^/]+)"))
            .replace(splatParam, "(.*?)");

        return new RegExp(`^${routeString}$`, routesAreCaseSensitive ? undefined : "i");
    }

    function stripParametersFromRoute(route) {
        const colonIndex = route.indexOf(":");
        const length = colonIndex > 0 ? colonIndex - 1 : route.length;
        return route.substring(0, length);
    }

    function endsWith(str, suffix) {
        return str.indexOf(suffix, str.length - suffix.length) !== -1;
    }

    function compareArrays(first, second) {
        if (!first || !second) {
            return false;
        }

        if (first.length != second.length) {
            return false;
        }

        for (let i = 0, len = first.length; i < len; i++) {
            if (first[i] != second[i]) {
                return false;
            }
        }

        return true;
    }

    function reconstructUrl(instruction) {
        if (!instruction.queryString) {
            return instruction.fragment;
        }

        return `${instruction.fragment}?${instruction.queryString}`;
    }

    /**
     * @class Router
     * @uses Events
     */

    /**
     * Triggered when the navigation logic has completed.
     * @event router:navigation:complete
     * @param {object} instance The activated instance.
     * @param {object} instruction The routing instruction.
     * @param {Router} router The router.
     */

    /**
     * Triggered when the navigation has been cancelled.
     * @event router:navigation:cancelled
     * @param {object} instance The activated instance.
     * @param {object} instruction The routing instruction.
     * @param {Router} router The router.
     */

    /**
     * Triggered when navigation begins.
     * @event router:navigation:processing
     * @param {object} instruction The routing instruction.
     * @param {Router} router The router.
     */

    /**
     * Triggered right before a route is activated.
     * @event router:route:activating
     * @param {object} instance The activated instance.
     * @param {object} instruction The routing instruction.
     * @param {Router} router The router.
     */

    /**
     * Triggered right before a route is configured.
     * @event router:route:before-config
     * @param {object} config The route config.
     * @param {Router} router The router.
     */

    /**
     * Triggered just after a route is configured.
     * @event router:route:after-config
     * @param {object} config The route config.
     * @param {Router} router The router.
     */

    /**
     * Triggered when the view for the activated instance is attached.
     * @event router:navigation:attached
     * @param {object} instance The activated instance.
     * @param {object} instruction The routing instruction.
     * @param {Router} router The router.
     */

    /**
     * Triggered when the composition that the activated instance participates in is complete.
     * @event router:navigation:composition-complete
     * @param {object} instance The activated instance.
     * @param {object} instruction The routing instruction.
     * @param {Router} router The router.
     */

    /**
     * Triggered when the router does not find a matching route.
     * @event router:route:not-found
     * @param {string} fragment The url fragment.
     * @param {Router} router The router.
     */

    const createRouter = function createRouter() {
        let queue = [];
        const isProcessing = ko.observable(false);
        let currentActivation;
        let currentInstruction;
        const activeItem = activator.create();

        const router = {
            /**
             * The route handlers that are registered. Each handler consists of a `routePattern` and a `callback`.
             * @property {object[]} handlers
             */
            handlers: [],
            /**
             * The route configs that are registered.
             * @property {object[]} routes
             */
            routes: [],
            /**
             * The route configurations that have been designated as displayable in a nav ui (nav:true).
             * @property {KnockoutObservableArray} navigationModel
             */
            navigationModel: ko.observableArray([]),
            /**
             * The active item/screen based on the current navigation state.
             * @property {Activator} activeItem
             */
            activeItem,
            /**
             * Indicates that the router (or a child router) is currently in the process of navigating.
             * @property {KnockoutComputed} isNavigating
             */
            isNavigating: ko.computed(() => {
                const current = activeItem();
                const processing = isProcessing();
                const currentRouterIsProcesing = !!(
                    current &&
                    current.router &&
                    current.router != router &&
                    current.router.isNavigating()
                );
                return processing || currentRouterIsProcesing;
            }),
            /**
             * An observable surfacing the active routing instruction that is currently being processed or has recently finished processing.
             * The instruction object has `config`, `fragment`, `queryString`, `params` and `queryParams` properties.
             * @property {KnockoutObservable} activeInstruction
             */
            activeInstruction: ko.observable(null),
            __router__: true,
        };

        events.includeIn(router);

        activeItem.settings.areSameItem = function areSameItem(
            currentItem,
            newItem,
            currentActivationData,
            newActivationData
        ) {
            if (currentItem == newItem) {
                return compareArrays(currentActivationData, newActivationData);
            }

            return false;
        };

        activeItem.settings.findChildActivator = function findChildActivator(item) {
            if (item && item.router && item.router.parent == router) {
                return item.router.activeItem;
            }

            return null;
        };

        function hasChildRouter(instance, parentRouter) {
            return instance.router && instance.router.parent == parentRouter;
        }

        function setCurrentInstructionRouteIsActive(flag) {
            if (currentInstruction && currentInstruction.config.isActive) {
                currentInstruction.config.isActive(flag);
            }
        }

        function completeNavigation(instance, instruction, mode) {
            system.log("Navigation Complete", instance, instruction);

            const fromModuleId = system.getModelName(currentActivation);
            if (fromModuleId) {
                router.trigger(`router:navigation:from:${fromModuleId}`);
            }

            currentActivation = instance;

            setCurrentInstructionRouteIsActive(false);
            currentInstruction = instruction;
            setCurrentInstructionRouteIsActive(true);

            const toModuleId = system.getModelName(currentActivation);
            if (toModuleId) {
                router.trigger(`router:navigation:to:${toModuleId}`);
            }

            if (!hasChildRouter(instance, router)) {
                router.updateDocumentTitle(instance, instruction);
            }

            // eslint-disable-next-line default-case
            switch (mode) {
                case "rootRouter":
                    lastUrl = reconstructUrl(currentInstruction);
                    break;
                case "rootRouterWithChild":
                    lastTryUrl = reconstructUrl(currentInstruction);
                    break;
                case "lastChildRouter":
                    lastUrl = lastTryUrl;
                    break;
            }

            rootRouter.explicitNavigation = false;
            rootRouter.navigatingBack = false;

            router.trigger("router:navigation:complete", instance, instruction, router);
        }

        function cancelNavigation(instance, instruction) {
            system.log("Navigation Cancelled");

            router.activeInstruction(currentInstruction);

            router.navigate(lastUrl, false);

            isProcessing(false);
            rootRouter.explicitNavigation = false;
            rootRouter.navigatingBack = false;
            router.trigger("router:navigation:cancelled", instance, instruction, router);
        }

        function redirect(url) {
            system.log("Navigation Redirecting");

            isProcessing(false);
            rootRouter.explicitNavigation = false;
            rootRouter.navigatingBack = false;
            router.navigate(url, { trigger: true, replace: true });
        }

        function activateRoute(activator, instance, instruction) {
            rootRouter.navigatingBack = !rootRouter.explicitNavigation && currentActivation != instruction.fragment;
            router.trigger("router:route:activating", instance, instruction, router);

            const options = {
                canDeactivate: !router.parent,
            };

            activator
                .activateItem(instance, instruction.params, options)
                .then((succeeded) => {
                    if (succeeded) {
                        const previousActivation = currentActivation;
                        const withChild = hasChildRouter(instance, router);
                        let mode = "";

                        if (router.parent) {
                            if (!withChild) {
                                mode = "lastChildRouter";
                            }
                        } else if (withChild) {
                            mode = "rootRouterWithChild";
                        } else {
                            mode = "rootRouter";
                        }

                        completeNavigation(instance, instruction, mode);

                        if (withChild) {
                            instance.router.trigger("router:route:before-child-routes", instance, instruction, router);

                            let fullFragment = instruction.fragment;
                            if (instruction.queryString) {
                                fullFragment += `?${instruction.queryString}`;
                            }

                            instance.router.loadUrl(fullFragment);
                        }

                        if (previousActivation == instance) {
                            router.attached();
                            router.compositionComplete();
                        }
                    } else if (activator.settings.lifecycleData && activator.settings.lifecycleData.redirect) {
                        redirect(activator.settings.lifecycleData.redirect);
                    } else {
                        cancelNavigation(instance, instruction);
                    }

                    if (startDeferred) {
                        startDeferred.resolve();
                        startDeferred = null;
                    }
                })
                .catch((err) => {
                    system.error(err);
                });
        }

        /**
         * Inspects routes and modules before activation. Can be used to protect access by cancelling navigation or redirecting.
         * @method guardRoute
         * @param {object} instance The module instance that is about to be activated by the router.
         * @param {object} instruction The route instruction. The instruction object has config, fragment, queryString, params and queryParams properties.
         * @return {Promise|Boolean|String} If a boolean, determines whether or not the route should activate or be cancelled. If a string, causes a redirect to the specified route. Can also be a promise for either of these value types.
         */
        function handleGuardedRoute(activator, instance, instruction) {
            const resultOrPromise = router.guardRoute(instance, instruction);
            if (resultOrPromise || resultOrPromise === "") {
                if (resultOrPromise.then) {
                    resultOrPromise.then((result) => {
                        if (result) {
                            if (system.isString(result)) {
                                redirect(result);
                            } else {
                                activateRoute(activator, instance, instruction);
                            }
                        } else {
                            cancelNavigation(instance, instruction);
                        }
                    });
                } else if (system.isString(resultOrPromise)) {
                    redirect(resultOrPromise);
                } else {
                    activateRoute(activator, instance, instruction);
                }
            } else {
                cancelNavigation(instance, instruction);
            }
        }

        function ensureActivation(activator, instance, instruction) {
            if (router.guardRoute) {
                handleGuardedRoute(activator, instance, instruction);
            } else {
                activateRoute(activator, instance, instruction);
            }
        }

        function canReuseCurrentActivation(instruction) {
            return (
                currentInstruction &&
                currentInstruction.config === instruction.config &&
                currentActivation &&
                ((currentActivation.canReuseForRoute &&
                    currentActivation.canReuseForRoute.apply(currentActivation, instruction.params)) ||
                    (!currentActivation.canReuseForRoute &&
                        currentActivation.router &&
                        currentActivation.router.loadUrl))
            );
        }

        function dequeueInstruction() {
            if (isProcessing()) {
                return;
            }

            const instruction = queue.shift();
            queue = [];

            if (!instruction) {
                return;
            }

            isProcessing(true);
            router.activeInstruction(instruction);
            router.trigger("router:navigation:processing", instruction, router);

            if (canReuseCurrentActivation(instruction)) {
                const tempActivator = activator.create();
                tempActivator.forceActiveItem(currentActivation); // enforce lifecycle without re-compose
                tempActivator.settings.areSameItem = activeItem.settings.areSameItem;
                tempActivator.settings.findChildActivator = activeItem.settings.findChildActivator;
                ensureActivation(tempActivator, currentActivation, instruction);
            } else if (!instruction.config.moduleId) {
                ensureActivation(
                    activeItem,
                    {
                        viewUrl: instruction.config.viewUrl,
                        canReuseForRoute() {
                            return true;
                        },
                    },
                    instruction
                );
            } else {
                system
                    .acquire(instruction.config.moduleId)
                    .then((m) => {
                        const instance = system.resolveObject(m);

                        ensureActivation(activeItem, instance, instruction);
                    })
                    .catch((err) => {
                        cancelNavigation(null, instruction);
                        system.error(
                            `Failed to load routed module (${instruction.config.moduleId}). Details: ${err.message}`,
                            err
                        );
                    });
            }
        }

        function queueInstruction(instruction) {
            queue.unshift(instruction);
            dequeueInstruction();
        }

        // Given a route, and a URL fragment that it matches, return the array of
        // extracted decoded parameters. Empty or unmatched parameters will be
        // treated as `null` to normalize cross-browser behavior.
        function createParams(routePattern, fragment, queryString) {
            const params = routePattern.exec(fragment).slice(1);

            for (let i = 0; i < params.length; i++) {
                const current = params[i];
                params[i] = current ? decodeURIComponent(current) : null;
            }

            const queryParams = router.parseQueryString(queryString);
            if (queryParams) {
                params.push(queryParams);
            }

            return {
                params,
                queryParams,
            };
        }

        function configureRoute(config) {
            router.trigger("router:route:before-config", config, router);

            if (!system.isRegExp(config.route)) {
                config.title = config.title || router.convertRouteToTitle(config.route);

                if (!config.moduleId) {
                    system.error("A moduleId function that returns a viewmodel is required.");
                }

                if (config.viewUrl) {
                    system.error(
                        "The viewUrl behaviour is not supported in durandal-es6. Ensure you are using the moduleId behaviour and remove usage of the viewUrl."
                    );
                }

                config.hash = config.hash || router.convertRouteToHash(config.route);

                if (config.hasChildRoutes) {
                    config.route = `${config.route}*childRoutes`;
                }

                config.routePattern = routeStringToRegExp(config.route);
            } else {
                config.routePattern = config.route;
            }

            config.isActive = config.isActive || ko.observable(false);
            router.trigger("router:route:after-config", config, router);
            router.routes.push(config);

            router.route(config.routePattern, (fragment, queryString) => {
                const paramInfo = createParams(config.routePattern, fragment, queryString);
                queueInstruction({
                    fragment,
                    queryString,
                    config,
                    params: paramInfo.params,
                    queryParams: paramInfo.queryParams,
                });
            });
        }

        function mapRoute(config) {
            if (system.isArray(config.route)) {
                const isActive = config.isActive || ko.observable(false);

                for (let i = 0, { length } = config.route; i < length; i++) {
                    const current = system.extend({}, config);

                    current.route = config.route[i];
                    current.isActive = isActive;

                    if (i > 0) {
                        delete current.nav;
                    }

                    configureRoute(current);
                }
            } else {
                configureRoute(config);
            }

            return router;
        }

        /**
         * Parses a query string into an object.
         * @method parseQueryString
         * @param {string} queryString The query string to parse.
         * @return {object} An object keyed according to the query string parameters.
         */
        router.parseQueryString = function parseQueryString(queryString) {
            if (!queryString) {
                return null;
            }

            const pairs = queryString.split("&");

            if (pairs.length == 0) {
                return null;
            }

            const queryObject = {};

            for (let i = 0; i < pairs.length; i++) {
                const pair = pairs[i];
                if (pair !== "") {
                    const sp = pair.indexOf("=");
                    const key = sp === -1 ? pair : pair.substr(0, sp);
                    const value = sp === -1 ? null : decodeURIComponent(pair.substr(sp + 1).replace(/\+/g, " "));

                    const existing = queryObject[key];

                    if (existing) {
                        if (system.isArray(existing)) {
                            existing.push(value);
                        } else {
                            queryObject[key] = [existing, value];
                        }
                    } else {
                        queryObject[key] = value;
                    }
                }
            }

            return queryObject;
        };

        /**
         * Add a route to be tested when the url fragment changes.
         * @method route
         * @param {RegEx} routePattern The route pattern to test against.
         * @param {function} callback The callback to execute when the route pattern is matched.
         */
        router.route = function route(routePattern, callback) {
            router.handlers.push({
                routePattern,
                callback,
            });
        };

        /**
         * Attempt to load the specified URL fragment. If a route succeeds with a match, returns `true`. If no defined routes matches the fragment, returns `false`.
         * @method loadUrl
         * @param {string} fragment The URL fragment to find a match for.
         * @return {boolean} True if a match was found, false otherwise.
         */
        router.loadUrl = function loadUrl(fragment) {
            const { handlers } = router;
            let queryString = null;
            let coreFragment = fragment;
            const queryIndex = fragment.indexOf("?");

            if (queryIndex != -1) {
                coreFragment = fragment.substring(0, queryIndex);
                queryString = fragment.substr(queryIndex + 1);
            }

            if (router.relativeToParentRouter) {
                const instruction = this.parent.activeInstruction();
                coreFragment =
                    queryIndex == -1 ? instruction.params.join("/") : instruction.params.slice(0, -1).join("/");

                if (coreFragment && coreFragment.charAt(0) == "/") {
                    coreFragment = coreFragment.substr(1);
                }

                if (!coreFragment) {
                    coreFragment = "";
                }

                coreFragment = coreFragment.replace("//", "/").replace("//", "/");
            }

            coreFragment = coreFragment.replace(trailingSlash, "");

            for (let i = 0; i < handlers.length; i++) {
                const current = handlers[i];
                if (current.routePattern.test(coreFragment)) {
                    current.callback(coreFragment, queryString);
                    return true;
                }
            }

            system.log("Route Not Found", fragment, currentInstruction);
            router.trigger("router:route:not-found", fragment, router);

            if (router.parent) {
                lastUrl = lastTryUrl;
            }

            history.navigate(lastUrl, { trigger: false, replace: true });

            rootRouter.explicitNavigation = false;
            rootRouter.navigatingBack = false;

            return false;
        };

        let titleSubscription;

        function setTitle(value) {
            const appTitle = ko.unwrap(app.title);

            if (appTitle) {
                document.title = `${value} | ${appTitle}`;
            } else {
                document.title = value;
            }
        }

        // Allow observable to be used for app.title
        if (ko.isObservable(app.title)) {
            app.title.subscribe(() => {
                const instruction = router.activeInstruction();
                const title = instruction != null ? ko.unwrap(instruction.config.title) : "";
                setTitle(title);
            });
        }

        /**
         * Updates the document title based on the activated module instance, the routing instruction and the app.title.
         * @method updateDocumentTitle
         * @param {object} instance The activated module.
         * @param {object} instruction The routing instruction associated with the action. It has a `config` property that references the original route mapping config.
         */
        router.updateDocumentTitle = function updateDocumentTitle(instance, instruction) {
            const appTitle = ko.unwrap(app.title);
            const { title } = instruction.config;

            if (titleSubscription) {
                titleSubscription.dispose();
            }

            if (title) {
                if (ko.isObservable(title)) {
                    titleSubscription = title.subscribe(setTitle);
                    setTitle(title());
                } else {
                    setTitle(title);
                }
            } else if (appTitle) {
                document.title = appTitle;
            }
        };

        /**
         * Save a fragment into the hash history, or replace the URL state if the
         * 'replace' option is passed. You are responsible for properly URL-encoding
         * the fragment in advance.
         * The options object can contain `trigger: false` if you wish to not have the
         * route callback be fired, or `replace: true`, if
         * you wish to modify the current URL without adding an entry to the history.
         * @method navigate
         * @param {string} fragment The url fragment to navigate to.
         * @param {object|boolean} options An options object with optional trigger and replace flags. You can also pass a boolean directly to set the trigger option. Trigger is `true` by default.
         * @return {boolean} Returns true/false from loading the url.
         */
        router.navigate = function navigate(fragment, options) {
            if (fragment && fragment.indexOf("://") != -1) {
                window.location.href = fragment;
                return true;
            }

            if (
                options === undefined ||
                (system.isBoolean(options) && options) ||
                (system.isObject(options) && options.trigger)
            ) {
                rootRouter.explicitNavigation = true;
            }

            if (
                (system.isBoolean(options) && !options) ||
                (options && options.trigger != undefined && !options.trigger)
            ) {
                lastUrl = fragment;
            }

            return history.navigate(fragment, options);
        };

        /**
         * Navigates back in the browser history.
         * @method navigateBack
         */
        router.navigateBack = function navigateBack() {
            history.navigateBack();
        };

        router.attached = function attached() {
            router.trigger("router:navigation:attached", currentActivation, currentInstruction, router);
        };

        router.compositionComplete = function compositionComplete() {
            isProcessing(false);
            router.trigger("router:navigation:composition-complete", currentActivation, currentInstruction, router);
            dequeueInstruction();
        };

        /**
         * Converts a route to a hash suitable for binding to a link's href.
         * @method convertRouteToHash
         * @param {string} route
         * @return {string} The hash.
         */
        router.convertRouteToHash = function convertRouteToHash(route) {
            route = route.replace(/\*.*$/, "");

            if (router.relativeToParentRouter) {
                const instruction = router.parent.activeInstruction();
                let hash = route ? `${instruction.config.hash}/${route}` : instruction.config.hash;

                if (history._hasPushState) {
                    hash = `/${hash}`;
                }

                hash = hash.replace("//", "/").replace("//", "/");
                return hash;
            }

            if (history._hasPushState) {
                return route;
            }

            return `#${route}`;
        };

        /**
         * Converts a route to a displayable title. This is only called if no title is specified as part of the route mapping.
         * @method convertRouteToTitle
         * @param {string} route
         * @return {string} The title.
         */
        router.convertRouteToTitle = function convertRouteToTitle(route) {
            const value = stripParametersFromRoute(route);
            return value.substring(0, 1).toUpperCase() + value.substring(1);
        };

        /**
         * Maps route patterns to modules.
         * @method map
         * @param {string|object|object[]} route A route, config or array of configs.
         * @param {object} [config] The config for the specified route.
         * @chainable
         * @example
         router.map([
         { route: '', title:'Home', moduleId: 'homeScreen', nav: true },
         { route: 'customer/:id', moduleId: 'customerDetails'}
         ]);
         */
        router.map = function map(route, config) {
            if (system.isArray(route)) {
                for (let i = 0; i < route.length; i++) {
                    router.map(route[i]);
                }

                return router;
            }

            if (system.isString(route) || system.isRegExp(route)) {
                if (!config) {
                    config = {};
                } else if (system.isString(config)) {
                    config = { moduleId: config };
                }

                config.route = route;
            } else {
                config = route;
            }

            return mapRoute(config);
        };

        /**
         * Builds an observable array designed to bind a navigation UI to. The model will exist in the `navigationModel` property.
         * @method buildNavigationModel
         * @param {number} defaultOrder The default order to use for navigation visible routes that don't specify an order. The default is 100 and each successive route will be one more than that.
         * @chainable
         */
        router.buildNavigationModel = function buildNavigationModel(defaultOrder = 100) {
            const nav = [];
            const { routes } = router;
            let fallbackOrder = defaultOrder;

            for (let i = 0; i < routes.length; i++) {
                const current = routes[i];

                if (current.nav) {
                    if (!system.isNumber(current.nav)) {
                        current.nav = ++fallbackOrder;
                    }

                    nav.push(current);
                }
            }

            nav.sort((a, b) => a.nav - b.nav);
            router.navigationModel(nav);

            return router;
        };

        /**
         * Configures how the router will handle unknown routes.
         * @method mapUnknownRoutes
         * @param {object|function} [config] If not supplied, then the router will redirect unknown routes to the SPAs root route "/".
         * If a object is supplied, the object's moduleId prop represents the module id to route all unknown routes to.
         * Finally, if config is a function, it will be called back with the route instruction containing the route info. The function can then modify the instruction by adding a moduleId and the router will take over from there.
         * @param {string} [replaceRoute] If config is a module id, then you can optionally provide a route to replace the url with.
         * @chainable
         */
        router.mapUnknownRoutes = function mapUnknownRoutes(config, replaceRoute) {
            const catchAllRoute = "*catchall";
            const catchAllPattern = routeStringToRegExp(catchAllRoute);

            router.route(catchAllPattern, (fragment, queryString) => {
                if (!config) {
                    return redirect("/");
                }

                if (typeof config !== "function" && typeof config !== "object") {
                    system.error("mapUnknownRoutes: If provided the config param must be a function or an object.");
                }

                const paramInfo = createParams(catchAllPattern, fragment, queryString);
                const instruction = {
                    fragment,
                    queryString,
                    config: {
                        route: catchAllRoute,
                        routePattern: catchAllPattern,
                    },
                    params: paramInfo.params,
                    queryParams: paramInfo.queryParams,
                };

                // Functions are first-class objects in Javascript so Durandal's system.isObject will return true for a function
                if (typeof config === "object") {
                    instruction.config.moduleId = config.moduleId;
                    if (replaceRoute) {
                        history.navigate(replaceRoute, {
                            trigger: false,
                            replace: true,
                        });
                    }
                } else if (system.isFunction(config)) {
                    const result = config(instruction);
                    if (result && result.then) {
                        result.then(() => {
                            router.trigger("router:route:before-config", instruction.config, router);
                            router.trigger("router:route:after-config", instruction.config, router);
                            queueInstruction(instruction);
                        });
                        return;
                    }
                } else {
                    instruction.config = config;
                    instruction.config.route = catchAllRoute;
                    instruction.config.routePattern = catchAllPattern;
                }

                router.trigger("router:route:before-config", instruction.config, router);
                router.trigger("router:route:after-config", instruction.config, router);
                queueInstruction(instruction);
            });

            return router;
        };

        /**
         * Resets the router by removing handlers, routes, event handlers and previously configured options.
         * @method reset
         * @chainable
         */
        router.reset = function () {
            currentInstruction = currentActivation = undefined;
            router.handlers = [];
            router.routes = [];
            router.off();
            delete router.options;
            return router;
        };

        /**
         * Makes all configured routes and/or module ids relative to a certain base url.
         * @method makeRelative
         * @param {object} settings An object, you can specify `route` to prefix the routes. In place of specifying route, you can set `fromParent:true` to make routes automatically relative to the parent router's active route.
         * @chainable
         */
        router.makeRelative = function (settings) {
            if (settings.route && !endsWith(settings.route, "/")) {
                settings.route += "/";
            }

            if (settings.fromParent) {
                router.relativeToParentRouter = true;
            }

            router.on("router:route:before-config").then((config) => {
                if (settings.moduleId) {
                    system.error(
                        "The settings.moduleId behaviour has been removed. Ensure you have updated your app's route config to use the durandal-es6 behaviour for moduleId."
                    );
                }

                if (settings.route) {
                    if (config.route === "") {
                        config.route = settings.route.substring(0, settings.route.length - 1);
                    } else {
                        config.route = settings.route + config.route;
                    }
                }
            });

            if (settings.dynamicHash) {
                router.on("router:route:after-config").then((config) => {
                    config.routePattern = routeStringToRegExp(
                        config.route ? `${settings.dynamicHash}/${config.route}` : settings.dynamicHash
                    );
                    config.dynamicHash = config.dynamicHash || ko.observable(config.hash);
                });

                // eslint-disable-next-line no-unused-vars
                router.on("router:route:before-child-routes").then((instance, instruction, parentRouter) => {
                    const childRouter = instance.router;

                    for (let i = 0; i < childRouter.routes.length; i += 1) {
                        const route = childRouter.routes[i];
                        const params = instruction.params.slice(0);

                        route.hash = childRouter
                            .convertRouteToHash(route.route)
                            .replace(namedParam, (match) => (params.length > 0 ? params.shift() : match));

                        route.dynamicHash(route.hash);
                    }
                });
            }

            return router;
        };

        /**
         * Creates a child router.
         * @method createChildRouter
         * @return {Router} The child router.
         */
        router.createChildRouter = function createChildRouter() {
            const childRouter = createRouter();
            childRouter.parent = router;
            return childRouter;
        };

        return router;
    };

    /**
     * @class RouterModule
     * @extends Router
     * @static
     */
    rootRouter = createRouter();
    rootRouter.explicitNavigation = false;
    rootRouter.navigatingBack = false;

    /**
     * Makes the RegExp generated for routes case sensitive, rather than the default of case insensitive.
     * @method makeRoutesCaseSensitive
     */
    rootRouter.makeRoutesCaseSensitive = function makeRoutesCaseSensitive() {
        routesAreCaseSensitive = true;
    };

    /**
     * Verify that the target is the current window
     * @method targetIsThisWindow
     * @return {boolean} True if the event's target is the current window, false otherwise.
     */
    rootRouter.targetIsThisWindow = function targetIsThisWindow(event) {
        const targetWindow = $(event.target).attr("target");

        if (
            !targetWindow ||
            targetWindow === window.name ||
            targetWindow === "_self" ||
            (targetWindow === "top" && window === window.top)
        ) {
            return true;
        }

        return false;
    };

    /**
     * Activates the router and the underlying history tracking mechanism.
     * @method activate
     * @return {Promise} A promise that resolves when the router is ready.
     */
    rootRouter.activate = function (options) {
        return system
            .defer((dfd) => {
                startDeferred = dfd;
                rootRouter.options = system.extend({ routeHandler: rootRouter.loadUrl }, rootRouter.options, options);

                history.activate(rootRouter.options);

                if (history._hasPushState) {
                    const { routes } = rootRouter;
                    let i = routes.length;

                    while (i--) {
                        const current = routes[i];
                        current.hash = current.hash.replace("#", "/");
                    }
                }

                const rootStripper = rootRouter.options.root && new RegExp(`^${rootRouter.options.root}/`);

                $(document).on("click", "a", function (evt) {
                    // ignore default prevented since these are not supposed to behave like links anyway
                    if (evt.isDefaultPrevented()) {
                        return;
                    }

                    if (history._hasPushState) {
                        if (
                            !evt.altKey &&
                            !evt.ctrlKey &&
                            !evt.metaKey &&
                            !evt.shiftKey &&
                            rootRouter.targetIsThisWindow(evt)
                        ) {
                            let href = $(this).attr("href");

                            // Ensure the protocol is not part of URL, meaning its relative.
                            // Stop the event bubbling to ensure the link will not cause a page refresh.
                            if (href != null && !(href.charAt(0) === "#" || /^[a-z]+:/i.test(href))) {
                                rootRouter.explicitNavigation = true;
                                evt.preventDefault();

                                if (rootStripper) {
                                    href = href.replace(rootStripper, "");
                                }

                                history.navigate(href);
                            }
                        }
                    } else {
                        rootRouter.explicitNavigation = true;
                    }
                });

                if (history.options.silent && startDeferred) {
                    startDeferred.resolve();
                    startDeferred = null;
                }
            })
            .promise();
    };

    /**
     * Deactivate current items and turn history listening off.
     * @method deactivate
     */
    rootRouter.deactivate = function () {
        rootRouter.activeItem(null);
        history.deactivate();
    };

    /**
     * Installs the router's custom ko binding handler.
     * @method install
     */
    rootRouter.install = function () {
        ko.bindingHandlers.router = {
            init() {
                return { controlsDescendantBindings: true };
            },
            update(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                let settings = ko.utils.unwrapObservable(valueAccessor()) || {};

                if (settings.__router__) {
                    settings = {
                        model: settings.activeItem(),
                        attached: settings.attached,
                        compositionComplete: settings.compositionComplete,
                        activate: false,
                    };
                } else {
                    const theRouter = ko.utils.unwrapObservable(settings.router || viewModel.router) || rootRouter;
                    settings.model = theRouter.activeItem();
                    settings.attached = theRouter.attached;
                    settings.compositionComplete = theRouter.compositionComplete;
                    settings.activate = false;
                }

                composition.compose(element, settings, bindingContext);
            },
        };

        ko.virtualElements.allowedBindings.router = true;
    };

    return rootRouter;
}

export default RouterModule();
