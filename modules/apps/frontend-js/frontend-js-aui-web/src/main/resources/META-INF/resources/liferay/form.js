AUI.add(
	'liferay-form',
	function(A) {
		var AArray = A.Array;

		var Lang = A.Lang;

		var formConfig;

		var DEFAULTS_FORM_VALIDATOR = A.config.FormValidator;

		var defaultAcceptFiles = DEFAULTS_FORM_VALIDATOR.RULES.acceptFiles;

		var TABS_SECTION_STR = 'TabsSection';

		var REGEX_NUMBER = /^[+\-]?(\d+)([.|,]\d+)*([eE][+-]?\d+)?$/;

		var REGEX_URL = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(https?\:\/\/|www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))((.*):(\d*)\/?(.*))?)/;

		var acceptFiles = function(val, node, ruleValue) {
			if (ruleValue == '*') {
				return true;
			}

			return defaultAcceptFiles(val, node, ruleValue);
		};

		var maxFileSize = function(val, node, ruleValue) {
			var nodeType = node.get('type').toLowerCase();

			if (nodeType === 'file') {
				return (ruleValue === 0 || node._node.files[0].size <= ruleValue);
			}

			return true;
		};

		var number = function(val, node, ruleValue) {
			return REGEX_NUMBER && REGEX_NUMBER.test(val);
		};

		var url = function(val, node, ruleValue) {
			return REGEX_URL && REGEX_URL.test(val);
		};

		A.mix(
			DEFAULTS_FORM_VALIDATOR.RULES,
			{
				acceptFiles: acceptFiles,
				maxFileSize: maxFileSize,
				number: number,
				url: url
			},
			true
		);

		A.mix(
			DEFAULTS_FORM_VALIDATOR.STRINGS,
			{
				DEFAULT: Liferay.Language.get('please-fix-this-field'),
				acceptFiles: Liferay.Language.get('please-enter-a-file-with-a-valid-extension-x'),
				alpha: Liferay.Language.get('please-enter-only-alpha-characters'),
				alphanum: Liferay.Language.get('please-enter-only-alphanumeric-characters'),
				date: Liferay.Language.get('please-enter-a-valid-date'),
				digits: Liferay.Language.get('please-enter-only-digits'),
				email: Liferay.Language.get('please-enter-a-valid-email-address'),
				equalTo: Liferay.Language.get('please-enter-the-same-value-again'),
				max: Liferay.Language.get('please-enter-a-value-less-than-or-equal-to-x'),
				maxFileSize: Liferay.Language.get('please-enter-a-file-with-a-valid-file-size-no-larger-than-x'),
				maxLength: Liferay.Language.get('please-enter-no-more-than-x-characters'),
				min: Liferay.Language.get('please-enter-a-value-greater-than-or-equal-to-x'),
				minLength: Liferay.Language.get('please-enter-at-list-x-characters'),
				number: Liferay.Language.get('please-enter-a-valid-number'),
				range: Liferay.Language.get('please-enter-a-value-between-x-and-x'),
				rangeLength: Liferay.Language.get('please-enter-a-value-between-x-and-x-characters-long'),
				required: Liferay.Language.get('this-field-is-required'),
				url: Liferay.Language.get('please-enter-a-valid-url')
			},
			true
		);

		var Form = A.Component.create(
			{
				ATTRS: {
					fieldRules: {
						setter: function(val) {
							var instance = this;

							instance._processFieldRules(val);

							return val;
						}
					},
					id: {},
					namespace: {},
					onSubmit: {
						valueFn: function() {
							var instance = this;

							return instance._onSubmit;
						}
					},
					validateOnBlur: {
						validator: Lang.isBoolean,
						value: true
					}
				},

				EXTENDS: A.Base,

				prototype: {
					initializer: function() {
						var instance = this;

						var id = instance.get('id');

						var form = document[id];
						var formNode = A.one(form);

						instance.form = form;
						instance.formNode = formNode;

						if (formNode) {
							var formValidator = new A.FormValidator(
								{
									boundingBox: formNode,
									validateOnBlur: instance.get('validateOnBlur')
								}
							);

							A.Do.before('_focusInvalidFieldTab', formValidator, 'focusInvalidField', instance);

							instance.formValidator = formValidator;

							instance._processFieldRules();

							instance._bindForm();
						}
					},

					addRule: function(fieldName, validatorName, errorMessage, body, custom) {
						var instance = this;

						var fieldRules = instance.get('fieldRules');

						var ruleIndex = instance._findRuleIndex(fieldRules, fieldName, validatorName);

						if (ruleIndex == -1) {
							fieldRules.push(
								{
									body: body || '',
									custom: custom || false,
									errorMessage: errorMessage || '',
									fieldName: fieldName,
									validatorName: validatorName
								}
							);

							instance._processFieldRules(fieldRules);
						}
					},

					removeRule: function(fieldName, validatorName) {
						var instance = this;

						var fieldRules = instance.get('fieldRules');

						var ruleIndex = instance._findRuleIndex(fieldRules, fieldName, validatorName);

						if (ruleIndex != -1) {
							var rule = fieldRules[ruleIndex];

							instance.formValidator.resetField(rule.fieldName);

							fieldRules.splice(ruleIndex, 1);

							instance._processFieldRules(fieldRules);
						}
					},

					_afterGetFieldsByName: function(fieldName) {
						var instance = this;

						var editorString = 'Editor';

						if (fieldName.lastIndexOf(editorString) === (fieldName.length - editorString.length)) {
							var formNode = instance.formNode;

							return new A.Do.AlterReturn(
								'Return editor dom element',
								formNode.one('#' + fieldName)
							);
						}
					},

					_bindForm: function() {
						var instance = this;

						var formNode = instance.formNode;
						var formValidator = instance.formValidator;

						formValidator.on('submit', A.bind('_onValidatorSubmit', instance));
						formValidator.on('submitError', A.bind('_onSubmitError', instance));

						formNode.delegate(['blur', 'focus'], A.bind('_onFieldFocusChange', instance), 'button,input,select,textarea');
						formNode.delegate(['blur', 'input'], A.bind('_onEditorBlur', instance), 'div[contenteditable="true"]');

						A.Do.after('_afterGetFieldsByName', formValidator, 'getFieldsByName', instance);
					},

					_defaultSubmitFn: function(event) {
						var instance = this;

						if (!event.stopped) {
							submitForm(instance.form);
						}
					},

					_findRuleIndex: function(fieldRules, fieldName, validatorName) {
						var ruleIndex = -1;

						AArray.some(
							fieldRules,
							function(element, index) {
								if (element.fieldName === fieldName &&
									element.validatorName === validatorName) {
									ruleIndex = index;

									return true;
								}
							}
						);

						return ruleIndex;
					},

					_focusInvalidFieldTab: function() {
						var instance = this;

						var formNode = instance.formNode;

						var field = formNode.one('.' + instance.formValidator.get('errorClass'));

						if (field) {
							var formTabs = formNode.one('.lfr-nav');

							if (formTabs) {
								var tabs = formTabs.all('.tab');
								var tabsNamespace = formTabs.getAttribute('data-tabs-namespace');

								var tabNames = AArray.map(
									tabs._nodes,
									function(tab) {
										return tab.getAttribute('data-tab-name');
									}
								)

								var fieldWrapper = field.ancestor('form > div');

								var fieldWrapperId = fieldWrapper.getAttribute('id').slice(0, -TABS_SECTION_STR.length);

								var fieldTabId = AArray.find(
									tabs._nodes,
									function(tab) {
										return tab.getAttribute('id').indexOf(fieldWrapperId) !== -1;
									}
								)

								Liferay.Portal.Tabs.show(tabsNamespace, tabNames, fieldTabId.getAttribute('data-tab-name'));
							}
						}
					},

					_onEditorBlur: function(event) {
						var instance = this;

						var formValidator = instance.formValidator;

						formValidator.validateField(event.target);
					},

					_onFieldFocusChange: function(event) {
						var instance = this;

						var row = event.currentTarget.ancestor('.field');

						if (row) {
							row.toggleClass('field-focused', event.type === 'focus');
						}
					},

					_onSubmit: function(event) {
						var instance = this;

						event.preventDefault();

						setTimeout(
							function() {
								instance._defaultSubmitFn(event);
							},
							0
						);
					},

					_onSubmitError: function(event) {
						var instance = this;

						var collapsiblePanels = instance.formNode.all('.panel-collapse');

						collapsiblePanels.each(
							function(panel) {
								var errorFields = panel.get('children').all('.has-error');

								if (errorFields.size() > 0 && !panel.hasClass('in')) {
									var panelNode = panel.getDOM();

									AUI.$(panelNode).collapse('show');
								}
							}
						);
					},

					_onValidatorSubmit: function(event) {
						var instance = this;

						var onSubmit = instance.get('onSubmit');

						onSubmit.call(instance, event.validator.formEvent);
					},

					_processFieldRule: function(rules, strings, rule) {
						var instance = this;

						var value = true;

						var fieldName = rule.fieldName;
						var validatorName = rule.validatorName;

						if (typeof rule.body !== 'undefined' && !rule.custom) {
							value = rule.body;
						}

						var fieldRules = rules[fieldName];

						if (!fieldRules) {
							fieldRules = {};

							rules[fieldName] = fieldRules;
						}

						fieldRules[validatorName] = value;

						if (rule.custom) {
							DEFAULTS_FORM_VALIDATOR.RULES[validatorName] = rule.body;
						}

						var errorMessage = rule.errorMessage;

						if (errorMessage) {
							var fieldStrings = strings[fieldName];

							if (!fieldStrings) {
								fieldStrings = {};

								strings[fieldName] = fieldStrings;
							}

							fieldStrings[validatorName] = errorMessage;
						}
					},

					_processFieldRules: function(fieldRules) {
						var instance = this;

						if (!fieldRules) {
							fieldRules = instance.get('fieldRules');
						}

						var fieldStrings = {};
						var rules = {};

						for (var rule in fieldRules) {
							instance._processFieldRule(rules, fieldStrings, fieldRules[rule]);
						}

						var formValidator = instance.formValidator;

						if (formValidator) {
							formValidator.set('fieldStrings', fieldStrings);
							formValidator.set('rules', rules);
						}
					}
				},

				get: function(id) {
					var instance = this;

					return instance._INSTANCES[id];
				},

				register: function(config) {
					var instance = this;

					formConfig = config;

					var form = new Liferay.Form(config);

					var formName = config.id || config.namespace;

					instance._INSTANCES[formName] = form;

					Liferay.fire(
						'form:registered',
						{
							form: form,
							formName: formName
						}
					);

					return form;
				},

				_INSTANCES: {}
			}
		);

		Liferay.Form = Form;
	},
	'',
	{
		requires: ['aui-base', 'aui-form-validator']
	}
);