import '@polymer/polymer/polymer-legacy.js';
import { Polymer } from '@polymer/polymer/lib/legacy/polymer-fn.js';
Polymer({
    is: 'rest-data-provider',

    properties: {

        loading: {
            type: Boolean,
            notify: true,
            value: false
        },

        delay: {
            type: Number,
            value: 100
        },

        count: {
            type: Number,
            value: 0,
            notify: true
        },

        received: {
            type: Number,
            value: 0,
            notify: true
        },

        url: {
            type: String
        },

        colmap: {
            type: Object,
            value: function () {
                return {}
            }
        },

        columns: {
            type: Array,
            notify: true
        },

        frozen: {
            type: Array,
            value: function () {
                return []
            }
        },

        itemMap: {
            type: Object,
            value: function () {
                return {}
            },
            notify: true
        },

        primaryFieldName: {
            type: String,
            value: "id"
        },

        timeseries: {
            type: Boolean,
            value: false
        },

        stop: {
            type: Number,
            value: 0
        },

        filter: {
            type: String
        },

        provider: {
            notify: true,
        },

        finished: {
            type: Boolean,
            value: false,
            notify: true
        }
    },

    observers: [
        '_computeDataProvider(filter, url)'
    ],

    _computeDataProvider: function (filter, url) {
        if (this.url && this.url.length)
            this.debounce('_computeDataProvider', function () {
                this.stop = 0;
                this.count = 0;
                this.received = 0;
                this.finished = false;
                var _this = this;
                this.set('provider', function (opts, callback) {
                    if (_this.finished)
                        return;
                    if (!opts.page) {
                        _this.count = 0;
                        _this.received = 0;
                    }
                    var xhr = new XMLHttpRequest();
                    var url = _this.url + '?';
                    url += 'limit=' + opts.pageSize + '&';
                    if(url.indexOf('v2/orgs') !== -1){
                        url += 'allorgs=true&'
                    }
                    if (!_this.timeseries) {
                        url += 'start=' + (opts.page * opts.pageSize) + '&';
                    } else if (_this.stop) {
                        url += 'stop=' + Math.floor(_this.stop) + '&';
                    }
                    if (_this.filter) {
                        url += 'filter=' + encodeURIComponent(_this.filter);
                        console.log('filter', _this.filter);
                    }
                    if (opts.sortOrders && opts.sortOrders.length)
                        url += 'order=' + encodeURIComponent(opts.sortOrders.map(
                            function (b) {
                                return (b.direction == 'desc' ? '-' : '') + b.path
                            }))
                    if (opts.page == 0)
                        _this.set('received', 0);
                    xhr.open('GET', url);

                    xhr.onreadystatechange = function () {
                        if (xhr.readyState === 4 && xhr.status === 200) {
                            var response = JSON.parse(xhr.responseText),
                                items;
                            if (!_this.timeseries && xhr.responseURL.indexOf('v2') === -1) {
                                _this.count = response.count;
                                items = response.items;
                            } else if (xhr.responseURL.indexOf('v2') !== -1) {
                                items = response.data;
                                _this.count = response.meta.returned
                            } else {
                                items = response;
                                _this.count += items.length;
                                if (items.length < opts.pageSize)
                                    _this.set('finished', true);
                            }
                            _this.received += items.length;
                            if (!_this.itemMap)
                                _this.itemMap = {};
                            if (items && items.length) {
                                // update column map using response.items values
                                items.forEach(function (i) {
                                    _this.itemMap[i[_this.primaryFieldName]] =
                                        i;
                                    Object.keys(i).forEach(function (k) {
                                        _this.colmap[k] = true;
                                    });
                                });
                                _this.set('received', Object.keys(_this.itemMap).length);
                                // Compute columns list from colmap, removing frozen columns
                                var cols = Object.keys(_this.colmap);
                                _this.frozen.forEach(function (f) {
                                    if (cols.indexOf(f) > -1)
                                        cols.splice(cols.indexOf(f), 1);
                                });
                                _this.set('columns', cols);
                                if (_this.timeseries && items.length == opts.pageSize) {
                                    _this.set('stop', items[items.length - 1][_this
                                        .primaryFieldName
                                    ])
                                    console.log('setting stop to', items[items.length -
                                        1][_this.primaryFieldName])
                                } else if (_this.timeseries && items.length < opts.pageSize) {
                                    _this.count = _this.received;
                                }
                            }

                            const sectionName = _this.url.split('/').slice(-1)[0];
                            _this.dispatchEvent(new CustomEvent(`update-${sectionName}`,
                                                                {detail: _this.itemMap, bubbles: true, 
                                                                composed: true}));
                            callback(items, _this.count);
                            if (_this.parentElement) {
                                _this.parentElement.async(function () {
                                    this.fire('resize')
                                }, 1000);
                            }
                        }
                        _this.loading = false;
                    };

                    xhr.send();
                    _this.loading = true;
                });

            }, 500);
    }
});
