sap.ui.define([
	"sap/ui/core/Component",
	"sap/m/Button",
	"sap/m/Bar",
	"sap/m/MessageToast"
], function (Component, Button, Bar, MessageToast) {

	return Component.extend("com.grc.pc.delegation.Component", {

		metadata: {
			"manifest": "json",
			includes: [
				"css/style.css"
			]
		},

		init: function () {
			this.i18nModel = new sap.ui.model.resource.ResourceModel({
				bundleName: "com.grc.pc.delegation.i18n.i18n"
			});
			var sServiceUrl = "/sap/opu/odata/sap/ZTEST_SRV";
			var sUrl = "/sap/opu/odata/sap/GC_SEM_OBJ_SRV";
			this.setModel(this.i18nModel, "i18n");
			this.oModel1 = new sap.ui.model.odata.v2.ODataModel(sServiceUrl, true);
			this.oModel2 = new sap.ui.model.odata.v2.ODataModel(sUrl, true);
			var that = this;
			var rendererPromise = this._getRenderer();
			this._subscribeEvents();

			rendererPromise.then(function (oRenderer) {
				that.oRenderer = oRenderer;
			});
			var oService = new sap.ushell.services.URLParsing();
			this.semanticObject = oService.getShellHash(window.location.href);
			if (this.semanticObject !== "Shell-home") {
				console.log("entered Init")
				var appMeta = {};
				appMeta.sShellHash = this.semanticObject;
				this.onAppOpened(null, null, appMeta, null);
			}
		},

		buildDialog: function () {
			var that = this;
			if (!this.dialogFragment) {
				this.dialogFragment = sap.ui.xmlfragment("com.grc.pc.delegation.fragment.delegation", this);
				this.dialogFragment.setModel(this.oModel1);
				this.dialogFragment.setModel(this.i18nModel, "i18n");
				this.dialogFragment.attachConfirm(that, that.handleConfirm);
			}
			this.dialogFragment.open();

		},
		_subscribeEvents: function () {
			sap.ui.getCore().getEventBus().subscribe(
				"launchpad",
				"appOpened",
				this.onAppOpened,
				this
			);
			sap.ui.getCore().getEventBus().subscribe(
				"sap.ushell",
				"appOpened",
				this.onAppOpened,
				this
			);
		},

		onAppOpened: async function (e1, e2, appMeta, e4) {
			console.log("AppOpened");
			await this._createSubHeader().then((b) => {

			});

			await this.readSemObjs().then((arr) => {
				console.log("entered");
				var sSem, sHash, sFhash;
				sHash = appMeta["sShellHash"];
				if (!sHash)
					sFhash = appMeta["sFixedShellHash"];

				if (sHash) {
					sSem = sHash.split("-")[0];
				} else if (sFhash) {
					sSem = sFhash.split("-")[0];
				};

				sSem = sSem.replace(/[^\w\s]/gi, '');
				if (this.searchSemanticObject(sSem, arr) == true) {
					this.oRenderer.showSubHeader(["idDelBar"], false, ["app"]);
				} else {
					this.oRenderer.hideSubHeader(["idDelBar"], false, ["app"]);
				}

			});

		},

		searchSemanticObject: function (sem, aSemObjs) {
			var bSuccess = false;
			for (var i = 0; i < aSemObjs.length; i++) {
				if (aSemObjs[i].SemObj === sem) {
					bSuccess = true;
				}
			}
			return bSuccess;
		},

		readSemObjs: function () {
			var that = this;
			return new Promise((resolve, reject) => {
				if (!that.semObjs) {
					this.oModel2.read("/SEM_OBJECTSSet", {
						success: function (oData, oResponse) {
							that.semObjs = oData.results;
							console.log("resolved");
							resolve(oData.results);
						}
					});
				} else
					resolve(that.semObjs);
			});
		},

		_createSubHeader: function () {
			var that = this;
			var oRenderer = this.oRenderer;
			return new Promise((resolve, reject) => {
				var oTitle, oLink;
				if(!that.subHeaderCreated){
				that.oModel1.read("/DelegationSet", {
					success: function (oData, response) {
						that.username = oData.results[0].username;
						var text = ((oData.results[0].delegate) ? "own_text" : "delegation_text");
						oTitle = new sap.m.Title("delText", {
							text: that.i18nModel.getResourceBundle().getText(text, [oData.results[0].fullname])
						});
						oLink = new sap.m.Link("idLink", {
							text: that.i18nModel.getResourceBundle().getText("delegation"),
							press: () => that.buildDialog()
						});
						oRenderer.addSubHeader("sap.m.Bar", {
							id: "idDelBar",
							contentRight: [oTitle, oLink]
						}, true, false, [sap.ushell.renderers.fiori2.RendererExtensions.LaunchpadState.App]);
						console.log("Subheader added");
						oRenderer.hideSubHeader(["idDelBar"], false, ["app"]);
						that.subHeaderCreated = true;
						resolve(true);
					},

					error: function (e) {
						reject(true);
					}
				});
				}
				else
				{
					resolve(true);
				}
			});
		},

		handleConfirm: function (oEvent, oRef) {
			var userId = oEvent.getParameters().selectedItem.getProperty("description");
			var userName = oEvent.getParameters().selectedItem.getProperty("title");
			if (userName !== oRef.username) {
				sap.ui.getCore().byId("delText").setText(oRef.getModel("i18n").getResourceBundle().getText("delegation_text", [userName]));

				oRef.oModel1.callFunction("/Set_delegation", {
					method: "POST",
					urlParameters: {
						"Username": userId
					},
					async: true,
					success: function (oData, response) {
						/*eslint-disable sap-no-location-reload */
						window.location.reload();
						/*eslint-enable sap-no-location-reload */
					},
					error: function (oError) {}
				});

			}
		},

		_getRenderer: function () {
			var that = this,
				oDeferred = new jQuery.Deferred(),
				oRenderer;

			that._oShellContainer = jQuery.sap.getObject("sap.ushell.Container");
			if (!that._oShellContainer) {
				oDeferred.reject(
					"Illegal state: shell container not available; this component must be executed in a unified shell runtime context.");
			} else {
				oRenderer = that._oShellContainer.getRenderer();
				if (oRenderer) {
					oDeferred.resolve(oRenderer);
				} else {
					// renderer not initialized yet, listen to rendererCreated event
					that._onRendererCreated = function (oEvent) {
						oRenderer = oEvent.getParameter("renderer");
						if (oRenderer) {
							oDeferred.resolve(oRenderer);
						} else {
							oDeferred.reject("Illegal state: shell renderer not available after recieving 'rendererLoaded' event.");
						}
					};
					that._oShellContainer.attachRendererCreatedEvent(that._onRendererCreated);
				}
			}
			return oDeferred.promise();
		}
	});
});