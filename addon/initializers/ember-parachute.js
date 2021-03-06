import Ember from 'ember';
import QueryParams from '../query-params';
import ParachuteEvent from '../-private/parachute-event';
import lookupController from '../utils/lookup-controller';

const {
  RSVP,
  run,
  assign,
  canInvoke,
  tryInvoke,
  sendEvent
} = Ember;

const {
  keys
} = Object;

export function initialize(/* application */) {
  if (Ember.Route._didInitializeParachute) {
    return;
  }

  Ember.Route.reopen({
    /**
     * Setup the route's `queryParams` map and call the `setup` hook
     * on the controller.
     *
     * @method setupController
     * @public
     * @param {Ember.Controller} controller
     * @returns {void}
     */
    setupController(controller, model, transition) {
      this._super(...arguments);

      if (QueryParams.hasParachute(controller)) {
        this._setupParachuteQueryParamsMap(controller);

        let { routeName } = this;
        let event = new ParachuteEvent(routeName, controller, {});

        // Overrides
        event.changed = event.changes;
        event.shouldRefresh = true;

        tryInvoke(controller, 'setup', [event, transition]);
        sendEvent(controller, 'setup', [event, transition]);
      }
    },

    /**
     * Call the `reset` hook on the controller.
     *
     * @method resetController
     * @public
     * @param {Ember.Controller} controller
     * @param  {Boolean} isExiting
     * @returns {void}
     */
    resetController(controller, isExiting) {
      this._super(...arguments);

      if (QueryParams.hasParachute(controller)) {
        let { routeName } = this;
        let event = new ParachuteEvent(routeName, controller, {});

        // Overrides
        event.shouldRefresh = false;

        tryInvoke(controller, 'reset', [event, isExiting]);
        sendEvent(controller, 'reset', [event, isExiting]);
      }
    },

    /**
     * For Engines support. `transition.handlerInfos` is used to compute
     * the query params that will be injected into a controller. In lazily
     * loaded engines, handlerInfos maybe promises that don't contain the required
     * information. Resolve them here to guarantee parachute can properly function.
     *
     * @method deserialize
     * @param {Object} params the parameters extracted from the URL
     * @param {Transition} transition
     * @returns {Promise<any>} The model for this route
     */
    async deserialize(params, transition) {
      await RSVP.all(
        transition.handlerInfos.map(x => x.handlerPromise)
      );

      return this._super(params, transition);
    },

    /**
     * Serialize query param value if a given query param has a `serialize`
     * method.
     *
     * @private
     * @param {any} value
     * @param {string} urlKey
     * @returns {any}
     */
    serializeQueryParam(value, urlKey/**, defaultValueType **/) {
      let controller = lookupController(this);

      if (QueryParams.hasParachute(controller)) {
        let queryParam = QueryParams.lookupQueryParam(controller, urlKey);

        if (canInvoke(queryParam, 'serialize')) {
          return queryParam.serialize(value, controller);
        }
      }

      return this._super(...arguments);
    },

    /**
     * Deserialize query param value if a given query param has a `deserialize`
     * method.
     *
     * @private
     * @param {any} value
     * @param {string} urlKey
     * @returns {any}
     */
    deserializeQueryParam(value, urlKey/**, defaultValueType **/) {
      let controller = lookupController(this);

      if (QueryParams.hasParachute(controller)) {
        let queryParam = QueryParams.lookupQueryParam(controller, urlKey);

        if (canInvoke(queryParam, 'deserialize')) {
          return queryParam.deserialize(value, controller);
        }
      }

      return this._super(...arguments);
    },

    /**
     * Schedule a QueryParamChangeEvent when query params change.
     *
     * @private
     * @param {string} routeName
     * @param {Ember.Controller} controller
     * @param {object} [changed={}]
     * @returns {void}
     */
    _scheduleParachuteChangeEvent(routeName, controller, changed = {}) {
      run.schedule('afterRender', this, () => {
        let event = new ParachuteEvent(routeName, controller, changed);

        tryInvoke(controller, 'queryParamsDidChange', [event]);
        sendEvent(controller, 'queryParamsDidChange', [event]);
      });
    },

    /**
     * Setup the route's `queryParams` map if it doesnt already exist from
     * the controller's Parachute meta.
     *
     * @method _setupParachuteQueryParamsMap
     * @private
     * @param {Ember.Controller} controller
     * @returns {void}
     */
    _setupParachuteQueryParamsMap(controller) {
      if (!this.__hasSetupParachuteQPs) {
        let qpMap = this.get('queryParams');
        let { qpMapForRoute } = QueryParams.metaFor(controller);

        keys(qpMapForRoute).forEach(key => {
          qpMapForRoute[key] = assign({}, qpMapForRoute[key], qpMap[key]);
        });

        this.set('queryParams', qpMapForRoute);
        this.__hasSetupParachuteQPs = true;
      }
    },

    actions: {
      /**
       * Route hook that fires when query params are changed.
       *
       * @public
       * @param {object} [changed={}]
       * @param {object} [present={}]
       * @param {object} [removed={}]
       * @returns {any}
       */
      queryParamsDidChange(changed = {}, present = {}, removed = {}) {
        let { controller, routeName } = this;

        if (QueryParams.hasParachute(controller)) {
          this._scheduleParachuteChangeEvent(routeName, controller, assign({}, changed, removed));
        }

        return this._super(...arguments);
      }
    }
  });

  Ember.Route.reopenClass({ _didInitializeParachute: true })
}

export default {
  name: 'ember-parachute',
  initialize
};
