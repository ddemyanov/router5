var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

import constants, { errorCodes } from '../../constants';
import safeBrowser from './browser';
import withUtils from './utils';

var defaultOptions = {
    forceDeactivate: true,
    useHash: false,
    hashPrefix: '',
    base: false,
    mergeState: false,
    preserveHash: false
};

var source = 'popstate';

function browserPluginFactory() {
    var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var browser = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : safeBrowser;

    var options = _extends({}, defaultOptions, opts);
    var transitionOptions = { forceDeactivate: options.forceDeactivate, source: source };

    function browserPlugin(router) {
        var routerOptions = router.getOptions();
        var routerStart = router.start;

        withUtils(router, options);

        router.start = function () {
            for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                args[_key] = arguments[_key];
            }

            if (args.length === 0 || typeof args[0] === 'function') {
                routerStart.apply(undefined, [browser.getLocation(options)].concat(args));
            } else {
                routerStart.apply(undefined, args);
            }

            return router;
        };

        router.replaceHistoryState = function (name) {
            var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

            var state = router.buildState(name, params);
            var url = router.buildUrl(name, params);
            router.lastKnownState = state;
            browser.replaceState(state, '', url);
        };

        function updateBrowserState(state, url, replace) {
            var trimmedState = state ? {
                meta: state.meta,
                name: state.name,
                params: state.params,
                path: state.path
            } : state;
            var finalState = options.mergeState === true ? _extends({}, browser.getState(), trimmedState) : trimmedState;
            if (replace) browser.replaceState(finalState, '', url);else browser.pushState(finalState, '', url);
        }

        function onPopState(evt) {
            var routerState = router.getState();
            // Do nothing if no state or if last know state is poped state (it should never happen)
            var newState = !evt.state || !evt.state.name;
            var state = newState ? router.matchPath(browser.getLocation(options), source) : evt.state;
            var defaultRoute = routerOptions.defaultRoute,
                defaultParams = routerOptions.defaultParams;


            if (!state) {
                // If current state is already the default route, we will have a double entry
                // Navigating back and forth will emit SAME_STATES error
                defaultRoute && router.navigateToDefault(_extends({}, transitionOptions, { reload: true, replace: true }));
                return;
            }
            if (routerState && router.areStatesEqual(state, routerState, false)) {
                return;
            }

            router.transitionToState(state, routerState, transitionOptions, function (err, toState) {
                if (err) {
                    if (err.redirect) {
                        var _err$redirect = err.redirect,
                            name = _err$redirect.name,
                            params = _err$redirect.params;


                        router.navigate(name, params, _extends({}, transitionOptions, { replace: true }));
                    } else if (err === errorCodes.CANNOT_DEACTIVATE) {
                        var url = router.buildUrl(routerState.name, routerState.params);
                        if (!newState) {
                            // Keep history state unchanged but use current URL
                            updateBrowserState(state, url, true);
                        }
                        // else do nothing or history will be messed up
                        // TODO: history.back()?
                    } else {
                        // Force navigation to default state
                        defaultRoute && router.navigate(defaultRoute, defaultParams, _extends({}, transitionOptions, { reload: true, replace: true }));
                    }
                } else {
                    router.invokeEventListeners(constants.TRANSITION_SUCCESS, toState, routerState, { replace: true });
                }
            });
        }

        function onStart() {
            if (options.useHash && !options.base) {
                // Guess base
                options.base = browser.getBase();
            }

            browser.addPopstateListener(onPopState);
        }

        function onStop() {
            browser.removePopstateListener(onPopState);
        }

        function onTransitionSuccess(toState, fromState, opts) {
            var historyState = browser.getState();
            var replace = opts.replace || fromState && router.areStatesEqual(toState, fromState, false) || opts.reload && historyState && router.areStatesEqual(toState, historyState, false);
            var url = router.buildUrl(toState.name, toState.params);
            if (fromState === null && options.preserveHash === true) {
                url += browser.getHash();
            }
            updateBrowserState(toState, url, replace);
        }

        return { onStart: onStart, onStop: onStop, onTransitionSuccess: onTransitionSuccess, onPopState: onPopState };
    };

    browserPlugin.pluginName = 'BROWSER_PLUGIN';

    return browserPlugin;
}

export default browserPluginFactory;