'use strict';

/*
------------------------------------------------------------------------------
* Copyright 2021 JSM (Genesys.com), Inc. or its affiliates. All Rights Reserved.
------------------------------------------------------------------------------
*/

const fs = require('fs');
const csv = require('fast-csv');

const fieldSeparator = ',';

const defaultSettingsFile = './config/DefaultToolSettings.json';

const toolSupport = {
	'debugLevel': ['0', '1', '2'],
	'action': ['export', 'updateACDAutoAnswer', 'updateRoles', 'test'],
	'selectUsersInclude': ['active', 'inactive', 'deleted'],
	'selectUsersBy': ['value', 'file'],
	'selectUsersByType': ['all', 'custom', 'role', 'division', 'email', 'name', 'gcid', 'manager', 'location', 'group', 'language', 'skill', 'profileSkill', 'certification', 'department', 'addresses', 'primaryContactInfo'],
	'selectUsersByFileAs': ['jsonMap', 'json', 'jsonArray', 'csv'],
	'verifyInput': ['0', '1', '2'],
	'enablePostSelectionFilter': ['true', 'false'],
	'customFilterFile': './config/DefaultSelectUsersWithCustomFilter.json',
	'filterConditionsAsAnd': ['true', 'false'],
	'useQ64Pagination': ['true', 'false'],
	'useGroupsSearch': ['true', 'false'],
	'acdAutoAnswerValue': ['true', 'false', 'forceTrue', 'forceFalse'],
	'exportAs': ['json', 'csv', 'jsonArray', 'jsonMap'],
	'exportFile': './GCExportUsersTool_Export_001',
	'exportResolve': ['all', 'Locations', 'Groups', 'Managers'],
	'exportExtended': ['all', 'Queues', 'DirectReports', 'Managers', 'PhoneAlertTimeouts', 'RolesDivisions'],
	'exportInclude': ['all', 'HR', 'Biography', 'ProfileSkills', 'LanguagePreference', 'Certifications', 'Locations', 'Skills', 'Languages', 'Roles', 'Groups']
};

// Genesys Cloud Users Search API allows a maximum of 50 values in a query search criteria
const GC_MaxFieldValuesPerPage = 50;

/*
------------------------------------------------------------------------------
* GCTool Class
------------------------------------------------------------------------------
*/

class GCTool {

	constructor() {
		this.isVerified = false;

		this.debugLevel = 0;
		this.action = '';
		this.verifyInput = 0;
		this.oauth = {
			'clientID': '',
			'clientSecret': '',
			'orgRegion': ''
		};
		this.selectUsers = {
			'include': [],
			'byType': '',
			'by': '',
			'byValue': '',
			'byFile': '',
			'byFileAs': '',
			'byFileAttributeName': '',
			'withCustomFilter': [],
			'customFilterFile': '',
			'filterConditionsAsAnd': false,
			'enablePostSelectionFilter': false,
			'useQ64Pagination': true,
			'useGroupsSearch': false
		};
		this.update = {};
		this.update.acdAutoAnswer = {
			'turnOn': false,
			'forceUpdate': false
		};
		this.update.roles = {
			'remove': [],
			'add': {}
		};
		this.export = {
			'as': '',
			'file': '',
			'fieldSeparator': ',',
			'resolve': {
				'locations': false,
				'groups': false,
				'managers': false
			},
			'extended': {
				'queues': false,
				'directReports': false,
				'managers': false,
				'phoneAlertTimeouts': false,
				'rolesDivisions': false
			},
			'include': {
				'hr': false,
				'biography': false,
				'profileSkills': false,
				'languagePreference': false,
				'certifications': false,
				'locations': false,
				'skills': false,
				'languages': false,
				'roles': false,
				'groups': false
			}
		};

	}

	//#region Load Tool Settings from file and from command line arguments (override)

	printInformation() {
		// Print Tool Information
		console.log(`GCUsersTool:\n \
    -h, -help: Help\n \
    -settings: ./DefaultToolSettings.json\n \
    -debugLevel, -debug: ${toolSupport.debugLevel.toString()}\n \
    -action: ${toolSupport.action.toString()}\n \
    -oauthClientID, -oaci: Your Genesys Cloud OAuth ClientID\n \
    -oauthClientSecret, -oacs: Your Genesys Cloud OAuth ClientSecret\n \
    -oauthOrgRegion, -oaor: Your Genesys Cloud Org Region\n \
    -includeUsers, -incu: comma separated string with ${toolSupport.selectUsersInclude.toString()}\n \
    -selectByType, -sbytype: ${toolSupport.selectUsersByType.toString()}\n \
    -selectBy, -sby: ${toolSupport.selectUsersBy.toString()}\n \
    -selectByValue, -sbyval: comma separated string (or pipe separated string for select by location)\n \
    -selectByFile, -sbyfile: filename\n \
    -selectByFileAs, -sbyfas: ${toolSupport.selectUsersByFileAs.toString()}\n \
    -selectByFileAttributeName, -sbyfan: attribute or column name\n \
    -enablePostSelectionFilter, -spost: ${toolSupport.enablePostSelectionFilter.toString()} (default: false)\n \
    -verifyInput, -sverify: ${toolSupport.verifyInput.toString()}\n \
    -customFilterFile, -sfilter: filename (default: ${toolSupport.customFilterFile.toString()})\n \
    -filterConditionsAsAnd, -scondand: ${toolSupport.filterConditionsAsAnd.toString()} (default: false)\n \
    -useQ64Pagination: ${toolSupport.useQ64Pagination.toString()} (default: true)\n \
    -useGroupsSearch: ${toolSupport.useGroupsSearch.toString()} (default: false)\n \
    -enableACDAutoAnswer, -acdaa: ${toolSupport.acdAutoAnswerValue.toString()}\n \
    -rolesToRemove, -rolrem: comma separated string with role names\n \
    -rolesToAdd, -roladd: comma separated string with rolename(division1;division2;...)\n \
    -exportAs, -exas: ${toolSupport.exportAs.toString()}\n \
    -exportFile, -exfile: filename (default: ${toolSupport.exportFile.toString()})\n \
    -exportResolve, -exres: comma separated string with ${toolSupport.exportResolve.toString()}\n \
    -exportExtended, -exext: comma separated string with ${toolSupport.exportExtended.toString()}\n \
    -exportInclude, -exinc: comma separated string with ${toolSupport.exportInclude.toString()}\n \
    `);
	}

	_verifySettings() {
		try {
			// check action
			if (toolSupport.action.indexOf(this.action) > -1) {
				// valid
			} else {
				console.log(`Error - Invalid Settings - action - Exiting...`);
				this.isVerified = false;
				return this.isVerified;
			}
			// check selectUsersByType
			if (toolSupport.selectUsersByType.indexOf(this.selectUsers.byType) > -1) {
				// valid
				// if type is 'all' or 'custom', no value required - forcing by and byValue
				if (this.selectUsers.byType === 'all') {
					this.selectUsers.by = 'value';
					this.selectUsers.byValue = 'all';
				} else if (this.selectUsers.byType === 'custom') {
					this.selectUsers.by = 'value';
					this.selectUsers.byValue = 'custom';
					// check selectUsersByFile
					if (this.selectUsers.customFilterFile.trim().length == 0) {
						console.log(`Error - Invalid Settings - selectUsers.customFilterFile must be provided - Exiting...`);
						this.isVerified = false;
						return this.isVerified;
					}
					// load custom filter from file
					let fileCustomFilter = fs.readFileSync(this.selectUsers.customFilterFile);
					this.selectUsers.withCustomFilter = JSON.parse(fileCustomFilter);
				} else if (this.selectUsers.filterConditionsAsAnd == true) {
					if (this.selectUsers.byType === 'role') {
						console.log(`Error - Invalid Settings - the current type is not supported with AND conditions - Exiting...`);
						this.isVerified = false;
						return this.isVerified;
					} else if (this.selectUsers.byType === 'gcid' || this.selectUsers.byType === 'email' ||
						this.selectUsers.byType === 'name' || this.selectUsers.byType === 'custom' ||
						this.selectUsers.byType === 'division' || this.selectUsers.byType === 'manager' ||
						this.selectUsers.byType === 'department' || this.selectUsers.byType === 'all') {
						console.log(`Error - Invalid Settings - the current type is not compatible with AND conditions - Exiting...`);
						this.isVerified = false;
						return this.isVerified;
					}
				}
			} else {
				console.log(`Error - Invalid Settings - selectUsersByType - Exiting...`);
				this.isVerified = false;
				return this.isVerified;
			}
			// check selectUsersBy
			if (toolSupport.selectUsersBy.indexOf(this.selectUsers.by) > -1) {
				// valid
				if (this.selectUsers.by === 'file') {
					// check selectUsersByFileAs
					if (toolSupport.selectUsersByFileAs.indexOf(this.selectUsers.byFileAs) > -1) {
						// valid
					} else {
						console.log(`Error - Invalid Settings - selectUsersByFileAs - Exiting...`);
						this.isVerified = false;
						return this.isVerified;
					}
					// check selectUsersByFile
					if (this.selectUsers.byFile.trim().length == 0) {
						console.log(`Error - Invalid Settings - selectUsers.byFile must be provided - Exiting...`);
						this.isVerified = false;
						return this.isVerified;
					}
					// check selectUsersByFileAttributeName
					if (this.selectUsers.byFileAttributeName.trim().length == 0) {
						console.log(`Error - Invalid Settings - selectUsers.byFileAttributeName must be provided - Exiting...`);
						this.isVerified = false;
						return this.isVerified;
					}
				} else if (this.selectUsers.by === 'value') {
					// check byValue
					if (this.selectUsers.byValue.length == 0) {
						console.log(`Error - Invalid Settings - selectUsers.byValue must be provided - Exiting...`);
						this.isVerified = false;
						return this.isVerified;
					}
				}
			} else {
				console.log(`Error - Invalid Settings - selectUsersBy - Exiting...`);
				this.isVerified = false;
				return this.isVerified;
			}

			// check selectUsers
			this.selectUsers.include = this.selectUsers.include.filter((value) => toolSupport.selectUsersInclude.indexOf(value) > -1);

			// check exportAs
			if (this.action === 'export') {
				if (toolSupport.exportAs.indexOf(this.export.as) > -1) {
					// valid

					// check exportResolve
					if (this.export.resolveStr) {
						let resolveList = this.export.resolveStr.split(fieldSeparator);
						// Reset this.export.resolve
						this.export.resolve = {
							'locations': false,
							'groups': false,
							'managers': false
						};
						for (let i = 0; i < resolveList.length; i++) {
							let resolveResource = resolveList[i].trim();
							if (toolSupport.exportResolve.indexOf(resolveResource) > -1) {
								if (resolveResource === 'Locations') {
									this.export.resolve.locations = true;
								} else if (resolveResource === 'Groups') {
									this.export.resolve.groups = true;
								} else if (resolveResource === 'Managers') {
									this.export.resolve.managers = true;
								} else if (resolveResource === 'all') {
									this.export.resolve = {
										'locations': true,
										'groups': true,
										'managers': true
									};
								}
							}
						}
					}

					// check exportExtended
					if (this.export.extendedStr) {
						let extendedList = this.export.extendedStr.split(fieldSeparator);
						// Reset this.export.extended
						this.export.extended = {
							'queues': false,
							'directReports': false,
							'managers': false,
							'phoneAlertTimeouts': false,
							'rolesDivisions': false
						};
						for (let i = 0; i < extendedList.length; i++) {
							let extendedResource = extendedList[i].trim();
							if (toolSupport.exportExtended.indexOf(extendedResource) > -1) {
								if (extendedResource === 'Queues') {
									this.export.extended.queues = true;
								} else if (extendedResource === 'DirectReports') {
									this.export.extended.directReports = true;
								} else if (extendedResource === 'Managers') {
									this.export.extended.managers = true;
								} else if (extendedResource === 'PhoneAlertTimeouts') {
									this.export.extended.phoneAlertTimeouts = true;
								} else if (extendedResource === 'RolesDivisions') {
									this.export.extended.rolesDivisions = true;
								} else if (extendedResource === 'all') {
									this.export.extended = {
										'queues': true,
										'directReports': true,
										'managers': true,
										'phoneAlertTimeouts': true,
										'rolesDivisions': true
									};
								}
							}
						}
					}

					// check exportInclude
					if (this.export.includeStr) {
						let includeList = this.export.includeStr.split(fieldSeparator);
						// Reset this.export.include
						this.export.include = {
							'hr': false,
							'biography': false,
							'profileSkills': false,
							'languagePreference': false,
							'certifications': false,
							'locations': false,
							'skills': false,
							'languages': false,
							'roles': false,
							'groups': false
						};
						for (let i = 0; i < includeList.length; i++) {
							let includeResource = includeList[i].trim();
							if (toolSupport.exportInclude.indexOf(includeResource) > -1) {
								if (includeResource === 'hr') {
									this.export.include.hr = true;
								} else if (includeResource === 'Biography') {
									this.export.include.biography = true;
								} else if (includeResource === 'ProfileSkills') {
									this.export.include.profileSkills = true;
								} else if (includeResource === 'LanguagePreference') {
									this.export.include.languagePreference = true;
								} else if (includeResource === 'Certifications') {
									this.export.include.certifications = true;
								} else if (includeResource === 'Locations') {
									this.export.include.locations = true;
								} else if (includeResource === 'Skills') {
									this.export.include.skills = true;
								} else if (includeResource === 'Languages') {
									this.export.include.languages = true;
								} else if (includeResource === 'Roles') {
									this.export.include.roles = true;
								} else if (includeResource === 'Groups') {
									this.export.include.groups = true;
								} else if (includeResource === 'all') {
									this.export.include = {
										'hr': true,
										'biography': true,
										'profileSkills': true,
										'languagePreference': true,
										'certifications': true,
										'locations': true,
										'skills': true,
										'languages': true,
										'roles': true,
										'groups': true
									};
								}
							}
						}
					}
				} else {
					console.log(`Error - Invalid Settings - exportAs - Exiting...`);
					this.isVerified = false;
					return this.isVerified;
				}
			}

			// check acdAutoAnswerValue
			if (this.action === 'updateACDAutoAnswer' && this.update && this.update.acdAutoAnswer && this.update.acdAutoAnswer.valueStr) {
				let lowerCaseAAAValues = toolSupport.acdAutoAnswerValue.map(value => value.toLowerCase());
				if (lowerCaseAAAValues.indexOf(this.update.acdAutoAnswer.valueStr.toLowerCase()) > -1) {
					switch (this.update.acdAutoAnswer.valueStr.trim().toLowerCase()) {
						case 'true':
							this.update.acdAutoAnswer.turnOn = true;
							this.update.acdAutoAnswer.forceUpdate = false;
							break;
						case 'forcetrue':
							this.update.acdAutoAnswer.turnOn = true;
							this.update.acdAutoAnswer.forceUpdate = true;
							break;
						case 'false':
							this.update.acdAutoAnswer.turnOn = false;
							this.update.acdAutoAnswer.forceUpdate = false;
							break;
						case 'forcefalse':
							this.update.acdAutoAnswer.turnOn = false;
							this.update.acdAutoAnswer.forceUpdate = true;
							break;
					}
				} else {
					console.log(`Error - Invalid Settings - acdAutoAnswerValue - Exiting...`);
					this.isVerified = false;
					return this.isVerified;
				}
			}

			// Verify if necessary values are present
			if (this.oauth.clientID.trim().length == 0) {
				console.log(`Error - Invalid Settings - oauth.clientID must be provided - Exiting...`);
				this.isVerified = false;
				return this.isVerified;
			}
			if (this.oauth.clientSecret.trim().length == 0) {
				console.log(`Error - Invalid Settings - oauth.clientSecret must be provided - Exiting...`);
				this.isVerified = false;
				return this.isVerified;
			}
			if (this.oauth.orgRegion.trim().length == 0) {
				console.log(`Error - Invalid Settings - oauth.orgRegion must be provided - Exiting...`);
				this.isVerified = false;
				return this.isVerified;
			}

			this.isVerified = true;
			return this.isVerified;

		} catch (err) {
			console.log(`Error - Invalid Settings -Error - Exiting...:`, err);
			this.isVerified = false;
			return this.isVerified;
		}
	}

	loadSettings() {
		console.log(`    Loading Tool Settings...`);

		let toolSettingsFile = defaultSettingsFile;

		// Check if the command is run for -help or -h (Tool Information)
		// Check also for settings filename - if provided
		if (process.argv.length > 2) {
			for (let argIndex = 2; argIndex < process.argv.length; argIndex++) {
				let argValue = process.argv[argIndex];
				if (argValue.toLowerCase() === '-h' || argValue.toLowerCase() === '-help') {
					// Print Tool Information
					this.printInformation();
					// Force exit
					return false;
				} else if (argValue.toLowerCase() === '-settings') {
					if ((argIndex < process.argv.length - 1)) {
						let argParamValue = process.argv[argIndex + 1];
						if (argParamValue && (argParamValue.startsWith('-') == false)) {
							toolSettingsFile = argParamValue;
							argIndex++;
						} else {
							// Invalid Settings - Force exit
							console.log(`Unsupported Settings - Exiting...`);
							return false;
						}
					} else {
						// Invalid Settings - Force exit
						console.log(`Unsupported Settings - Exiting...`);
						return false;
					}
				}
			}
		}

		let toolSettings;
		// Load Settings from file
		try {
			if (toolSettingsFile && toolSettingsFile.length > 0) {
				let fileContent = fs.readFileSync(toolSettingsFile);
				toolSettings = JSON.parse(fileContent);

				this.debugLevel = toolSettings.debugLevel;
				this.action = toolSettings.action;
				this.verifyInput = toolSettings.verifyInput;
				this.oauth = { ...toolSettings.oauth };
				this.selectUsers = { ...toolSettings.selectUsers };
				this.update = {};
				this.update.acdAutoAnswer = { ...toolSettings.update.acdAutoAnswer };
				this.update.roles = { ...toolSettings.update.roles };
				this.export = { ...toolSettings.export };
			} else {
				console.log(`No Tool Settings file provided - Proceeding with defaultSettings...`);
			}
		} catch (err) {
			console.log(`Error loading Tool Settings file (not found, invalid) - Proceeding with defaultSettings...`);
			console.error(`Error: ${JSON.stringify(err, null, 4)}`);
		}

		// Override Tool Settings from Command Arguments
		try {
			if (process.argv.length > 2) {
				for (let argIndex = 2; argIndex < process.argv.length; argIndex++) {
					let argValue = process.argv[argIndex];
					if ((argIndex < process.argv.length - 1)) {
						let argParamValue = process.argv[argIndex + 1];
						if (argParamValue && (argParamValue.startsWith('-') == false)) {
							let isKnownCommandArg = true;
							switch (argValue) {
								case '-debugLevel':
								case '-debug':
									this.debugLevel = parseInt(argParamValue, 10);
									break;
								case '-settings':
									// Declared to avoid unsupported command argument error
									// Nothing to do - if present, custom settings file loaded earlier in this method/function
									break;
								case '-action':
									this.action = argParamValue;
									break;
								case '-oauthClientID':
									this.oauth.clientID = argParamValue;
									break;
								case '-oauthClientSecret':
									this.oauth.clientSecret = argParamValue;
									break;
								case '-oauthOrgRegion':
									this.oauth.orgRegion = argParamValue;
									break;
								case '-includeUsers':
								case '-incu':
									if (argParamValue) {
										let includeUsersList = argParamValue.split(fieldSeparator);
										// Reset this.selectUsers.include
										this.selectUsers.include = [];
										for (let i = 0; i < includeUsersList.length; i++) {
											let includeUser = includeUsersList[i].trim().toLowerCase();
											if (includeUser && includeUser.length > 0) {
												this.selectUsers.include.push(includeUser);
											}
										}
									}
									break;
								case '-selectByType':
								case '-sbyt':
									this.selectUsers.byType = argParamValue;
									break;
								case '-selectBy':
								case '-sby':
									this.selectUsers.by = argParamValue;
									break;
								case '-selectByValue':
								case '-sbyval':
									this.selectUsers.byValue = argParamValue;
									break;
								case '-selectByFile':
								case '-sbyfile':
									this.selectUsers.byFile = argParamValue;
									break;
								case '-selectByFileAs':
								case '-sbyfas':
									this.selectUsers.byFileAs = argParamValue;
									break;
								case '-selectByFileAttributeName':
								case '-sbyfan':
									this.selectUsers.byFileAttributeName = argParamValue;
									break;
								case '-enablePostSelectionFilter':
								case '-spost':
									if (argParamValue.trim().toLowerCase() === 'true') {
										this.selectUsers.enablePostSelectionFilter = true;
									} else {
										this.selectUsers.enablePostSelectionFilter = false;
									}
									break;
								case '-verifyInput':
								case '-sverify':
									this.verifyInput = parseInt(argParamValue, 10);
									break;
								case '-customFilterFile':
								case '-sfilter':
									this.selectUsers.customFilterFile = argParamValue;
									break;
								case '-filterConditionsAsAnd':
								case '-scondand':
									if (argParamValue.trim().toLowerCase() === 'true') {
										this.selectUsers.filterConditionsAsAnd = true;
									} else {
										this.selectUsers.filterConditionsAsAnd = false;
									}
									break;
								case '-useQ64Pagination':
									if (argParamValue.trim().toLowerCase() === 'true') {
										this.selectUsers.useQ64Pagination = true;
									} else {
										this.selectUsers.useQ64Pagination = false;
									}
									break;
								case '-useGroupsSearch':
									if (argParamValue.trim().toLowerCase() === 'true') {
										this.selectUsers.useGroupsSearch = true;
									} else {
										this.selectUsers.useGroupsSearch = false;
									}
									break;
								case '-enableACDAutoAnswer':
								case '-acdaa':
									this.update.acdAutoAnswer.valueStr = argParamValue;
									break;
								case '-exportAs':
								case '-exas':
									this.export.as = argParamValue;
									break;
								case '-exportFile':
								case '-exfile':
									this.export.file = argParamValue;
									break;
								case '-exportResolve':
								case '-exres':
									this.export.resolveStr = argParamValue;
									break;
								case '-exportExtended':
								case '-exext':
									this.export.extendedStr = argParamValue;
									break;
								case '-exportInclude':
								case '-exinc':
									this.export.includeStr = argParamValue;
									break;
								case '-rolesToRemove':
								case '-rolrem':
									if (argParamValue) {
										let removeRolesList = argParamValue.split(',');
										// Reset this.update.roles.remove
										this.update.roles.remove = [];
										for (let i = 0; i < removeRolesList.length; i++) {
											let removeRole = removeRolesList[i].trim();
											if (removeRole && removeRole.length > 0) {
												this.update.roles.remove.push(removeRole);
											}
										}
									}
									break;
								case '-rolesToAdd':
								case '-roladd':
									if (argParamValue) {
										let addRolesList = argParamValue.split(',');
										// Reset this.update.roles.add
										this.update.roles.add = {};
										for (let i = 0; i < addRolesList.length; i++) {
											// rolename(division1;division2;division3)
											let addRole = addRolesList[i].trim();
											if (addRole && addRole.length > 0) {
												let indexSeparatorStart = addRole.indexOf('(');
												let indexSeparatorEnd = addRole.indexOf(')');
												let addRoleName = addRole.substring(0, indexSeparatorStart).trim();
												let addRoleDivisions = addRole.substring(indexSeparatorStart + 1, indexSeparatorEnd);
												let addRoleDivisionsList = addRoleDivisions.split(';');
												for (let j = 0; j < addRoleDivisionsList.length; j++) {
													let addRoleDivision = addRoleDivisionsList[j].trim();
													if (addRoleDivision && addRoleDivision.length > 0) {
														if (!this.update.roles.add[addRoleName]) {
															this.update.roles.add[addRoleName] = [];
														}
														this.update.roles.add[addRoleName].push(addRoleDivision);
													}
												}
											}
										}
									}
									break;
								default:
									isKnownCommandArg = false;
									break;
							}
							// if the argument is one of the parameters supported by the tool
							// and if a value associated with the parameter was also read,
							// next argument index = current index + 2 (+1 here and +1 in the for loop)
							if (isKnownCommandArg) {
								argIndex++;
							}
						} else {
							// Invalid Command Arguments - Force exit
							console.log(`Unsupported Command Arguments - ${argValue} - Exiting...`);
							return false;
						}
					} else {
						// Invalid Command Arguments - Force exit
						console.log(`Unsupported Command Arguments - ${argValue} - Exiting...`);
						return false;
					}
				}
			}
		} catch (err) {
			console.log(`Error processing Command Arguments - Exiting...`);
			console.error(`Error: ${JSON.stringify(err, null, 4)}`);
			return false;
		}

		// Verify values are supported
		try {
			return this._verifySettings();
		} catch (err) {
			console.log(`Error verifying Tools Settings (invalid configuration file) - Exiting...`);
			return false;
		}
	}

	//#endregion

	//#region Get Expand and Settings

	_getExpandList() {
		let expandList = [];

		if (this.isVerified) {
			if (this.action === 'updateRoles' && this.selectUsers.enablePostSelectionFilter == false) {
				// Minimum information needed for users - authorization
				expandList = ['authorization'];
			} else if (this.action === 'updateACDAutoAnswer' && this.selectUsers.enablePostSelectionFilter == false) {
				// Minimum information needed for users - no need for expand
				// except if post selection filter is enabled
				expandList = [];
			} else if (this.action === 'test' && this.selectUsers.enablePostSelectionFilter == false) {
				// Minimum information needed for users - no need for expand
				// except if post selection filter is enabled
				expandList = [];
			} else if (this.selectUsers.enablePostSelectionFilter == true || this.action === 'export') {
				if (this.export && this.export.include) {
					if (this.export.include.roles && this.export.include.roles == true) {
						expandList.push('authorization');
					}
					if (this.export.include.profileSkills && this.export.include.profileSkills == true) {
						expandList.push('profileSkills');
					}
					if (this.export.include.certifications && this.export.include.certifications == true) {
						expandList.push('certifications');
					}
					if (this.export.include.locations && this.export.include.locations == true) {
						expandList.push('locations');
					}
					if (this.export.include.groups && this.export.include.groups == true) {
						expandList.push('groups');
					}
					if (this.export.include.skills && this.export.include.skills == true) {
						expandList.push('skills');
					}
					if (this.export.include.languages && this.export.include.languages == true) {
						expandList.push('languages');
					}
					if (this.export.include.languagePreference && this.export.include.languagePreference == true) {
						expandList.push('languagePreference');
					}
					if (this.export.include.hr && this.export.include.hr == true) {
						expandList.push('employerInfo');
					}
					if (this.export.include.biography && this.export.include.biography == true) {
						expandList.push('biography');
					}
				}
			}
		}

		return expandList;
	}

	// Public
	getSearchSettingsList() {
		let searchSettingsList = [];

		if (this.isVerified) {
			let usersSearchSetttings;
			switch (this.selectUsers.byType) {
				case 'gcid':
					usersSearchSetttings = {
						maxItems: 5000,
						maxValuesInCriteria: GC_MaxFieldValuesPerPage,
						usingApi: 'users',
						expandList: this._getExpandList(),
						queryFields: ['id'],
						queryConditionsAsAnd: this.selectUsers.filterConditionsAsAnd,
						includeUsers: this.selectUsers.include,
						customSearchCriteria: null,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(usersSearchSetttings);
					break;
				case 'email':
					usersSearchSetttings = {
						maxItems: 5000,
						maxValuesInCriteria: GC_MaxFieldValuesPerPage,
						usingApi: 'users',
						expandList: this._getExpandList(),
						queryFields: ['email'],
						queryConditionsAsAnd: this.selectUsers.filterConditionsAsAnd,
						includeUsers: this.selectUsers.include,
						customSearchCriteria: null,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(usersSearchSetttings);
					break;
				case 'name':
					usersSearchSetttings = {
						maxItems: 5000,
						maxValuesInCriteria: GC_MaxFieldValuesPerPage,
						usingApi: 'users',
						expandList: this._getExpandList(),
						queryFields: ['name'],
						queryConditionsAsAnd: this.selectUsers.filterConditionsAsAnd,
						includeUsers: this.selectUsers.include,
						customSearchCriteria: null,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(usersSearchSetttings);
					break;
				case 'department':
					usersSearchSetttings = {
						maxItems: 5000,
						maxValuesInCriteria: GC_MaxFieldValuesPerPage,
						usingApi: 'users',
						expandList: this._getExpandList(),
						queryFields: ['department'],
						queryConditionsAsAnd: this.selectUsers.filterConditionsAsAnd,
						includeUsers: this.selectUsers.include,
						customSearchCriteria: null,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(usersSearchSetttings);
					break;
				case 'skill':
					if (this.verifyInput > 0) {
						// Although Users Search can be done using the skill name,
						// the tool performs a search on skills to verify if the values, provided as input, exist
						let skillsSearchSetttings = {
							maxItems: 40,
							maxValuesInCriteria: 1,
							usingApi: 'skills',
							expandList: [],
							queryFields: [],
							queryConditionsAsAnd: false,
							includeUsers: [],
							customSearchCriteria: null,
							paginationMethod: 2,
							groupsSearchMethod: this.useGroupsSearch ? 1 : 2
						}
						searchSettingsList.push(skillsSearchSetttings);
					}
					usersSearchSetttings = {
						maxItems: 5000,
						maxValuesInCriteria: GC_MaxFieldValuesPerPage,
						usingApi: 'users',
						expandList: this._getExpandList(),
						queryFields: ['routingSkills'],
						queryConditionsAsAnd: this.selectUsers.filterConditionsAsAnd,
						includeUsers: this.selectUsers.include,
						customSearchCriteria: null,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(usersSearchSetttings);
					break;
				case 'profileSkill':
					usersSearchSetttings = {
						maxItems: 5000,
						maxValuesInCriteria: GC_MaxFieldValuesPerPage,
						usingApi: 'users',
						expandList: this._getExpandList(),
						queryFields: ['profileSkills'],
						queryConditionsAsAnd: this.selectUsers.filterConditionsAsAnd,
						includeUsers: this.selectUsers.include,
						customSearchCriteria: null,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(usersSearchSetttings);
					break;
				case 'certification':
					usersSearchSetttings = {
						maxItems: 5000,
						maxValuesInCriteria: GC_MaxFieldValuesPerPage,
						usingApi: 'users',
						expandList: this._getExpandList(),
						queryFields: ['certifications'],
						queryConditionsAsAnd: this.selectUsers.filterConditionsAsAnd,
						includeUsers: this.selectUsers.include,
						customSearchCriteria: null,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(usersSearchSetttings);
					break;
				case 'language':
					if (this.verifyInput > 0) {
						// Although Users Search can be done using the language name,
						// the tool performs a search on languages to verify if the values, provided as input, exist
						let languagesSearchSetttings = {
							maxItems: 40,
							maxValuesInCriteria: 1,
							usingApi: 'languages',
							expandList: [],
							queryFields: [],
							queryConditionsAsAnd: false,
							includeUsers: [],
							customSearchCriteria: null,
							paginationMethod: 2,
							groupsSearchMethod: this.useGroupsSearch ? 1 : 2
						}
						searchSettingsList.push(languagesSearchSetttings);
					}
					usersSearchSetttings = {
						maxItems: 5000,
						maxValuesInCriteria: GC_MaxFieldValuesPerPage,
						usingApi: 'users',
						expandList: this._getExpandList(),
						queryFields: ['languages'],
						queryConditionsAsAnd: this.selectUsers.filterConditionsAsAnd,
						includeUsers: this.selectUsers.include,
						customSearchCriteria: null,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(usersSearchSetttings);
					break;
				case 'addresses':
					usersSearchSetttings = {
						maxItems: 5000,
						maxValuesInCriteria: GC_MaxFieldValuesPerPage,
						usingApi: 'users',
						expandList: this._getExpandList(),
						queryFields: ['addresses'],
						queryConditionsAsAnd: this.selectUsers.filterConditionsAsAnd,
						includeUsers: this.selectUsers.include,
						customSearchCriteria: null,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(usersSearchSetttings);
					break;
				case 'primaryContactInfo':
					usersSearchSetttings = {
						maxItems: 5000,
						maxValuesInCriteria: GC_MaxFieldValuesPerPage,
						usingApi: 'users',
						expandList: this._getExpandList(),
						queryFields: ['primaryContactInfo'],
						queryConditionsAsAnd: this.selectUsers.filterConditionsAsAnd,
						includeUsers: this.selectUsers.include,
						customSearchCriteria: null,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(usersSearchSetttings);
					break;
				case 'all':
					usersSearchSetttings = {
						maxItems: 5000,
						maxValuesInCriteria: 1,
						usingApi: 'users',
						expandList: this._getExpandList(),
						queryFields: [],
						queryConditionsAsAnd: this.selectUsers.filterConditionsAsAnd,
						includeUsers: this.selectUsers.include,
						customSearchCriteria: null,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(usersSearchSetttings);
					break;
				case 'custom':
					usersSearchSetttings = {
						maxItems: 5000,
						maxValuesInCriteria: 1,
						usingApi: 'users',
						expandList: this._getExpandList(),
						queryFields: [],
						queryConditionsAsAnd: this.selectUsers.filterConditionsAsAnd,
						includeUsers: this.selectUsers.include,
						customSearchCriteria: this.selectUsers.withCustomFilter,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(usersSearchSetttings);
					break;
				case 'manager':
					let managersSearchSetttings = {
						maxItems: 40,
						maxValuesInCriteria: GC_MaxFieldValuesPerPage,
						usingApi: 'users',
						expandList: [],
						queryFields: ['email'],
						queryConditionsAsAnd: false,
						includeUsers: this.selectUsers.include,
						customSearchCriteria: null,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(managersSearchSetttings);
					usersSearchSetttings = {
						maxItems: 5000,
						maxValuesInCriteria: GC_MaxFieldValuesPerPage,
						usingApi: 'users',
						expandList: this._getExpandList(),
						queryFields: ['manager.id'],
						queryConditionsAsAnd: this.selectUsers.filterConditionsAsAnd,
						includeUsers: this.selectUsers.include,
						customSearchCriteria: null,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(usersSearchSetttings);
					break;
				case 'division':
					// Search on division (Get Authorization Divisions) does not support multiple values in the search
					// Setting maxValuesInCriteria to 1 to make sure one request is made for each of of the query values)
					let divisionsSearchSetttings = {
						maxItems: 40,
						maxValuesInCriteria: 1,
						usingApi: 'divisions',
						expandList: [],
						queryFields: [],
						queryConditionsAsAnd: false,
						includeUsers: [],
						customSearchCriteria: null,
						paginationMethod: 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(divisionsSearchSetttings);
					usersSearchSetttings = {
						maxItems: 5000,
						maxValuesInCriteria: GC_MaxFieldValuesPerPage,
						usingApi: 'users',
						expandList: this._getExpandList(),
						queryFields: ['divisionId'],
						queryConditionsAsAnd: this.selectUsers.filterConditionsAsAnd,
						includeUsers: this.selectUsers.include,
						customSearchCriteria: null,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(usersSearchSetttings);
					break;
				case 'group':
					let groupsSearchSetttings = {
						maxItems: 40,
						maxValuesInCriteria: 10,
						usingApi: 'groups',
						expandList: [],
						queryFields: ['name'],
						queryConditionsAsAnd: false,
						includeUsers: [],
						customSearchCriteria: null,
						paginationMethod: 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(groupsSearchSetttings);
					usersSearchSetttings = {
						maxItems: 5000,
						maxValuesInCriteria: GC_MaxFieldValuesPerPage,
						usingApi: 'users',
						expandList: this._getExpandList(),
						queryFields: ['groups.official.guid', 'groups.social.guid'],
						queryConditionsAsAnd: this.selectUsers.filterConditionsAsAnd,
						includeUsers: this.selectUsers.include,
						customSearchCriteria: null,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(usersSearchSetttings);
					break;
				case 'location':
					let locationsSearchSetttings = {
						maxItems: 40,
						maxValuesInCriteria: 10,
						usingApi: 'locations',
						expandList: [],
						queryFields: ['name'],
						queryConditionsAsAnd: false,
						includeUsers: [],
						customSearchCriteria: null,
						paginationMethod: 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(locationsSearchSetttings);
					usersSearchSetttings = {
						maxItems: 5000,
						maxValuesInCriteria: GC_MaxFieldValuesPerPage,
						usingApi: 'users',
						expandList: this._getExpandList(),
						queryFields: ['location.location.value.guid'],
						queryConditionsAsAnd: this.selectUsers.filterConditionsAsAnd,
						includeUsers: this.selectUsers.include,
						customSearchCriteria: null,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(usersSearchSetttings);
					break;
				case 'role':
					let rolesSearchSetttings = {
						maxItems: 40,
						maxValuesInCriteria: 10,
						usingApi: 'roles',
						expandList: [],
						queryFields: ['name'],
						includeUsers: [],
						customSearchCriteria: null,
						paginationMethod: 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(rolesSearchSetttings);
					let roleMembersSearchSetttings = {
						maxItems: 40,
						maxValuesInCriteria: 1,
						usingApi: 'roleMembers',
						expandList: [],
						queryFields: [],
						includeUsers: [],
						customSearchCriteria: null,
						paginationMethod: 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(roleMembersSearchSetttings);
					usersSearchSetttings = {
						maxItems: 5000,
						maxValuesInCriteria: GC_MaxFieldValuesPerPage,
						usingApi: 'users',
						expandList: this._getExpandList(),
						queryFields: ['id'],
						queryConditionsAsAnd: this.selectUsers.filterConditionsAsAnd,
						includeUsers: this.selectUsers.include,
						customSearchCriteria: null,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					}
					searchSettingsList.push(usersSearchSetttings);
					break;
				default:
					console.error(`Error - Unsupported SearchBy type: ${this.selectUsers.byType}`);
					return null;
					break;
			}
		}

		return searchSettingsList;
	}

	getResolveSettings(resolveType) {
		let resolveSettings = null;

		if (this.isVerified) {
			switch (resolveType) {
				case 'locations':
					resolveSettings = {
						maxItems: 100,
						maxValuesInCriteria: 10,
						usingApi: 'locations',
						expandList: [],
						queryFields: ['id'],
						includeUsers: [],
						customSearchCriteria: null,
						paginationMethod: 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					};
					break;
				case 'groups':
					resolveSettings = {
						maxItems: 100,
						maxValuesInCriteria: 10,
						usingApi: 'groups',
						expandList: [],
						queryFields: ['id'],
						includeUsers: [],
						customSearchCriteria: null,
						paginationMethod: 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					};
					break;
				case 'managers':
					resolveSettings = {
						maxItems: 100,
						maxValuesInCriteria: GC_MaxFieldValuesPerPage,
						usingApi: 'users',
						expandList: [],
						queryFields: ['id'],
						includeUsers: ['active', 'inactive', 'deleted'],
						customSearchCriteria: null,
						paginationMethod: this.useQ64Pagination ? 1 : 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					};
					break;
				case 'roles':
					resolveSettings = {
						maxItems: 40,
						maxValuesInCriteria: 10,
						usingApi: 'roles',
						expandList: [],
						queryFields: ['name'],
						includeUsers: [],
						customSearchCriteria: null,
						paginationMethod: 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					};
					break;
				case 'divisions':
					resolveSettings = {
						maxItems: 40,
						maxValuesInCriteria: 1,
						usingApi: 'divisions',
						expandList: [],
						queryFields: [],
						includeUsers: [],
						customSearchCriteria: null,
						paginationMethod: 2,
						groupsSearchMethod: this.useGroupsSearch ? 1 : 2
					};
					break;
				default:
					break;
			}
		}

		return resolveSettings;
	}

	//#endregion

	//#region Load Select Input (from file, from value)

	_importFromCSV(csvFile) {
		let inputRows = [];

		return new Promise((resolve, reject) => {
			fs.createReadStream(csvFile)
				.pipe(csv.parse({ headers: true, delimiter: this.selectUsers.fieldSeparator }))
				.on('error', error => {
					console.log(`An error was encountered: ${error}`);
					reject(error);
				})
				.on('data', row => inputRows.push(JSON.parse(JSON.stringify(row))))
				.on('end', rowCount => {
					console.log(`Parsed ${rowCount} rows`);
					resolve(inputRows);
				});
		});
	}

	// Public
	async loadSelectUsersInput() {
		if (this.debugLevel >= 1) console.log(`    Loading Select Users Input...`);
		let inputList = [];

		if (this.isVerified) {
			if (this.selectUsers.by === 'value') {
				let rawValue = this.selectUsers.byValue.trim();
				if (rawValue && rawValue.length > 0) {
					let rawList;
					if (this.selectUsers.byType === 'location') {
						rawList = rawValue.split('|');
					} else {
						rawList = rawValue.split(fieldSeparator);
					}
					for (let i = 0; i < rawList.length; i++) {
						let inputValue = rawList[i].trim();
						if (inputValue && inputValue.length > 0) {
							if (this.selectUsers.byType === 'manager' || this.selectUsers.byType === 'email' || this.selectUsers.byType === 'gcid') {
								inputList.push({
									'id': inputValue.toLowerCase()
								});
							} else {
								// all, role, group, location, department, name, skill, profileSkill, certification, language, addresses, primaryContactInfo
								inputList.push({
									'id': inputValue
								});
							}
						}
					}
				}
			} else if (this.selectUsers.by === 'file') {
				if ((this.selectUsers.byFileAs === 'json') ||
					(this.selectUsers.byFileAs === 'jsonArray') ||
					(this.selectUsers.byFileAs === 'jsonMap')) {
					try {
						let fileContent = fs.readFileSync(this.selectUsers.byFile);
						let fileContentList = JSON.parse(fileContent);

						if (this.selectUsers.byFileAs === 'jsonMap') {
							Object.keys(fileContentList).forEach(function (key) {
								let entity = fileContentList[key];
								if (entity[this.selectUsers.byFileAttributeName]) {
									if (this.selectUsers.byType === 'manager' || this.selectUsers.byType === 'email' || this.selectUsers.byType === 'gcid') {
										inputList.push({
											'id': entity[this.selectUsers.byFileAttributeName].trim().toLowerCase()
										});
									} else {
										// all, role, group, location, department, name, skill, profileSkill, certification, language, addresses, primaryContactInfo
										inputList.push({
											'id': entity[this.selectUsers.byFileAttributeName].trim()
										});
									}
								}
							});
						} else {
							fileContentList.forEach(function (entity) {
								if (entity[this.selectUsers.byFileAttributeName]) {
									if (this.selectUsers.byType === 'manager' || this.selectUsers.byType === 'email' || this.selectUsers.byType === 'gcid') {
										inputList.push({
											'id': entity[this.selectUsers.byFileAttributeName].trim().toLowerCase()
										});
									} else {
										// all, role, group, location, department, name, skill, profileSkill, certification, language, addresses, primaryContactInfo
										inputList.push({
											'id': entity[this.selectUsers.byFileAttributeName].trim()
										});
									}
								}
							});
						}
					} catch (err) {
						console.log(`Error loading Select Users Input JSON file (not found, invalid) - Exiting...`);
						console.error(`Error: ${JSON.stringify(err, null, 4)}`);
						return null;
					}
				} else if (this.selectUsers.byFileAs === 'csv') {
					try {
						let csvData = await this._importFromCSV(this.selectUsers.byFile);
						csvData.forEach((row) => {
							if (row[this.selectUsers.byFileAttributeName]) {
								if (this.selectUsers.byType === 'manager' || this.selectUsers.byType === 'email' || this.selectUsers.byType === 'gcid') {
									inputList.push({
										'id': row[this.selectUsers.byFileAttributeName].trim().toLowerCase()
									});
								} else {
									// all, role, group, location, department, name, skill, profileSkill, certification, language, addresses, primaryContactInfo
									inputList.push({
										'id': row[this.selectUsers.byFileAttributeName].trim()
									});
								}
							}
						});

					} catch (err) {
						console.log(`Error loading Select Users Input CSV file (not found, invalid) - Exiting...`);
						console.error(`Error: ${JSON.stringify(err, null, 4)}`);
						return null;
					}
				}
			}
		} else {
			return null;
		}

		return inputList;
	}

	//#endregion

}

module.exports = GCTool;
