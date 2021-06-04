'use strict';

/*
------------------------------------------------------------------------------
* Copyright 2021 JSM (Genesys.com), Inc. or its affiliates. All Rights Reserved.
------------------------------------------------------------------------------
*/

const fs = require('fs');
const csv = require('fast-csv');
const apiUtils = require('../libs/gcApiUtils.js');

// Genesys Cloud - Script/API Settings
const GC_MaxItemsPerBulkACD = 90;
const GC_MaxItemsPerBulkAddRole = 90;
const GC_MaxItemsPerBulkRemoveRole = 90;

/*
------------------------------------------------------------------------------
* GCUsers Class
------------------------------------------------------------------------------
*/

class GCUsers {

	constructor() {

		// list of selected users
		this.selected = [];

	}

	async selectUsers(gcTool, inputList) {
		// Reset selected users
		this.selected = [];

		// Get list of SearchSettings
		let searchSettingsList = gcTool.getSearchSettingsList();

		let searchRequestList = inputList;
		let searchResultList = [];
		for (let i = 0; i < searchSettingsList.length; i++) {
			let searchSettings = searchSettingsList[i];
			searchResultList = await apiUtils.searchAllPages(searchRequestList, searchSettings, gcTool.verifyInput);
			searchRequestList = searchResultList;
		}
		// searchResultList should be the list of selected users (final)
		this.selected = searchResultList;

		return;
	}

	filterUsers(gcTool, filterMethod) {
		if (gcTool.selectUsers.enablePostSelectionFilter == true) {
			if (gcTool.debugLevel >= 1) console.log(`GCUsersTool - User Post Selection Filter enabled.`);
			if (this.selected && this.selected.length > 0) {
				let filteredUsersResult = this.selected.filter((user) => filterMethod(gcTool, user));
				if (filteredUsersResult && filteredUsersResult.length > 0) {
					this.selected = filteredUsersResult;
					if (gcTool.debugLevel >= 1) console.log(`GCUsersTool - Successfully perfomed Post Selection Filter - Selected ${this.selected.length} users.`);
				} else {
					this.selected = [];
					console.log(`GCUsersTool - App Error - Empty filtered list (filtered users) - Exiting...`);
					return;
				}
			} else {
				console.log(`GCUsersTool - App Error - Empty list (selected users) - Exiting...`);
				return;
			}
		}

	}

	async changeACDAutoAnswer(gcTool, autoAnswer) {

		let bulkInformation = {
			'input': this.selected.length,
			'deleted': 0,
			'alreadySet': 0,
			'updated': 0
		};

		if (this.selected && this.selected.length > 0) {

			let bulkCount = 0;
			let bulkBody = [];
			for (let i = 0; i < this.selected.length; i++) {
				// check users who are not deleted and who are onot already with this autoAnswer
				if (this.selected[i].state === 'deleted') {
					bulkInformation.deleted++;
				} else {
					if (autoAnswer.forceUpdate) {
						bulkBody.push({
							'id': this.selected[i].id,
							'acdAutoAnswer': autoAnswer.turnOn
						});
						bulkCount++;
						bulkInformation.updated++;
					} else {
						if (this.selected[i].acdAutoAnswer != autoAnswer.turnOn) {
							bulkBody.push({
								'id': this.selected[i].id,
								'acdAutoAnswer': autoAnswer.turnOn
							});
							bulkCount++;
							bulkInformation.updated++;
						} else {
							bulkInformation.alreadySet++;
						}
					}
				}
				if (bulkCount >= GC_MaxItemsPerBulkACD) {
					// send bulk request
					let bulkUpdateResult = await apiUtils.bulkUpdateACDAutoAnswer(bulkBody);
					if (bulkUpdateResult) {
						bulkCount = 0;
						bulkBody = [];
					} else {
						// An error occured
						return null;
					};
				}
			}
			if (bulkCount > 0) {
				// send bulk request
				let bulkUpdateResult = await apiUtils.bulkUpdateACDAutoAnswer(bulkBody);
				if (bulkUpdateResult) {
					bulkCount = 0;
					bulkBody = [];
				} else {
					// An error occured
					return null;
				};
			}

			if (gcTool.debugLevel >= 2) {
				console.log(`DEBUG - Changing ACD Auto-Answer to ${autoAnswer.turnOn.toString()}.`);
				console.log(`DEBUG - Change Details: ${JSON.stringify(bulkInformation)}`);
			}

		} else {
			console.log(`GCUsersTool - App Error - Empty list (selected users) - Exiting...`);

		}

		return bulkInformation;
	}

	async updateRoles(gcTool, removeRolesMap, addRolesMap, divisionsMap, homeDivision) {

		let bulkInformation = {
			'input': this.selected.length
		};

		if (this.selected && this.selected.length > 0) {

			if (Object.keys(removeRolesMap).length > 0 || Object.keys(addRolesMap).length > 0) {

				// Init
				Object.keys(removeRolesMap).forEach((roleName) => {
					removeRolesMap[roleName].updateUsers = [];
				});

				Object.keys(addRolesMap).forEach((roleName) => {
					addRolesMap[roleName].updateUsers = [];
					addRolesMap[roleName].updateDivisions = [];
					addRolesMap[roleName].updateUserDivision = false;
					addRolesMap[roleName].updateDivisionUsersMap = {};

					addRolesMap[roleName].updateRequestedDivisions.forEach((divisionName) => {
						if (divisionName === '@Home') {
							if (!addRolesMap[roleName].updateDivisions.includes(homeDivision.id)) {
								addRolesMap[roleName].updateDivisions.push(homeDivision.id);
							}
						} else if (divisionName === '@User') {
							addRolesMap[roleName].updateUserDivision = true;
						} else {
							if (divisionsMap[divisionName]) {
								if (!addRolesMap[roleName].updateDivisions.includes(divisionsMap[divisionName].id)) {
									addRolesMap[roleName].updateDivisions.push(divisionsMap[divisionName].id);
								}
							}
						}
					});
				});


				// Ne plus faire le bulk remove api request des que l'on a max number per bulk request
				// faire ca en finish plutot - avec updateUsers qui peut etre superieur a max number et on fait un loop avec slice/splice dans ce cas

				// comme ca, dans la boucle user, on peut unifier/simplifier add et remove
				// rajouter un check sur @user utilise, et dans ce cas, faire un check si user.division.id est deja dans la liste
				// s'il n'y est pas, regarder si la map specific contient la clef divisionId. Si not, creer clef dans la map.
				// puis faire un push du userId dans cette map par divisionId.

				// For each selected user
				for (let i = 0; i < this.selected.length; i++) {
					let user = this.selected[i];

					if (Object.keys(removeRolesMap).length > 0) {
						if (user && user.authorization && user.authorization.roles) {
							Object.keys(removeRolesMap).forEach((roleName) => {
								let foundIndex = user.authorization.roles.findIndex(element => element.name === roleName);
								if (foundIndex > -1) {
									// role found
									removeRolesMap[roleName].updateUsers.push(user.id);
								}
							});
						}
					}

					if (Object.keys(addRolesMap).length > 0) {
						Object.keys(addRolesMap).forEach((roleName) => {
							addRolesMap[roleName].updateUsers.push(user.id);

							if (addRolesMap[roleName].updateUserDivision) {
								if (!addRolesMap[roleName].updateDivisions.includes(user.division.id)) {
									let role = addRolesMap[roleName];
									if (!role.updateDivisionUsersMap[user.division.id]) {
										role.updateDivisionUsersMap[user.division.id] = [];
									}
									role.updateDivisionUsersMap[user.division.id].push(user.id);
								}
							}
						});
					}

				}

				// Finish
				let rolesToRemove = Object.keys(removeRolesMap);
				for (let irem = 0; irem < rolesToRemove.length; irem++) {
					let roleName = rolesToRemove[irem];

					let role = removeRolesMap[roleName];

					if (role.updateUsers && role.updateUsers.length > 0) {
						let hasRemovedRole = false;
						let startRemoveIndex = 0;
						while (hasRemovedRole == false) {
							let bulkRemoveUsers = role.updateUsers.slice(startRemoveIndex, startRemoveIndex + GC_MaxItemsPerBulkRemoveRole);
							if (bulkRemoveUsers.length > 0) {
								let bulkRemoveResult = await apiUtils.bulkRemoveRole(role.id, bulkRemoveUsers);
								startRemoveIndex = startRemoveIndex + GC_MaxItemsPerBulkRemoveRole;
							} else {
								hasRemovedRole = true;
							}
						}
					}
				}

				let rolesToAdd = Object.keys(addRolesMap);
				for (let iadd = 0; iadd < rolesToAdd.length; iadd++) {
					let roleName = rolesToAdd[iadd];

					let role = addRolesMap[roleName];

					if (role.updateUsers && role.updateUsers.length > 0) {
						let hasAddedRole = false;
						let startAddIndex = 0;
						while (hasAddedRole == false) {
							let bulkAddUsers = role.updateUsers.slice(startAddIndex, startAddIndex + GC_MaxItemsPerBulkAddRole);
							if (bulkAddUsers.length > 0) {
								let bulkAddResult = await apiUtils.bulkAddRole(role.id, bulkAddUsers, role.updateDivisions);
								startAddIndex = startAddIndex + GC_MaxItemsPerBulkAddRole;
							} else {
								hasAddedRole = true;
							}
						}
					}

					if (role.updateUserDivision == true && Object.keys(role.updateDivisionUsersMap).length > 0) {
						let specificDivisionsToAdd = Object.keys(role.updateDivisionUsersMap);
						for (let ispecific = 0; ispecific < specificDivisionsToAdd.length; ispecific++) {
							let divisionId = specificDivisionsToAdd[ispecific];
							if (role.updateDivisionUsersMap[divisionId].length > 0) {
								let hasAddedSpecificDivision = false;
								let startAddSpecificIndex = 0;
								while (hasAddedSpecificDivision == false) {
									let bulkAddSpecificUsers = role.updateDivisionUsersMap[divisionId].slice(startAddSpecificIndex, startAddSpecificIndex + GC_MaxItemsPerBulkAddRole);
									if (bulkAddSpecificUsers.length > 0) {
										let bulkAddSpecificResult = await apiUtils.bulkAddRole(role.id, bulkAddSpecificUsers, [divisionId]);
										startAddSpecificIndex = startAddSpecificIndex + GC_MaxItemsPerBulkAddRole;
									} else {
										hasAddedSpecificDivision = true;
									}
								}
							}
						}
					}
				}

			}

		} else {
			console.log(`GCUsersTool - App Error - Empty list (selected users) - Exiting...`);

		}

		if (gcTool.debugLevel >= 1) {
			console.log(`DEBUG - Update Role Details: ${bulkInformation}`);
		}

		return bulkInformation;

	}

	async _resolveEntities(gcTool, entityIds, entityType) {

		let resolvedEntitiesMap = {};

		if (entityIds && entityIds.length > 0) {
			let searchSettings = gcTool.getResolveSettings(entityType);

			let searchReqestList = entityIds.map(obj => {
				let rObj = {
					'id': obj
				};
				return rObj
			})

			let entitiesResultList = await apiUtils.searchAllPages(searchReqestList, searchSettings, 0);

			if (entitiesResultList) {
				entitiesResultList.forEach((entity) => { resolvedEntitiesMap[entity.id] = JSON.parse(JSON.stringify(entity)); });
			}
		}

		return resolvedEntitiesMap;
	}

	async extendProfile(gcTool) {
		try {
			if (gcTool.export.extended.queues || gcTool.export.extended.directReports || gcTool.export.extended.managers || gcTool.export.extended.phoneAlertTimeouts || gcTool.export.extended.rolesDivisions || gcTool.export.resolve.managers || (gcTool.export.include.locations && gcTool.export.resolve.locations) || (gcTool.export.include.groups && gcTool.export.resolve.groups)) {
				console.log(`GCUsersTool - Starting to retrieve extended Users profile at:`, new Date(Date.now()).toISOString());
			} else {
				console.log(`GCUsersTool - No extended Users profile requested - Proceeding...`);
				return true;
			}

			if (this.selected && this.selected.length > 0) {

				let usersGroupIds = [];
				let resolvedGroups = {};
				let usersLocationIds = [];
				let resolvedLocations = {};
				let usersManagerIds = [];
				let resolvedManagers = {};

				if (this.selected) {
					for (let entityIndex in this.selected) {
						let entity = this.selected[entityIndex];

						if (gcTool.debugLevel >= 1) console.log(`    Extending Users profile for user with id:`, entity.id);

						if (gcTool.export.extended.queues) {
							let queues = await apiUtils.extendUserQueueInformation(entity.id);
							if (queues && queues.length > 0) {
								entity.queues = JSON.parse(JSON.stringify(queues));
							} else {
								entity.queues = [];
							}
						}
						if (gcTool.export.extended.rolesDivisions) {
							let userGrants = await apiUtils.extendUserInformation(entity.id, 'rolesDivisions');
							entity.grants = JSON.parse(JSON.stringify(userGrants.grants));
						}

						if (entity.state != 'deleted') {
							if (gcTool.export.extended.directReports || gcTool.export.extended.managers) {
								let adjacents = await apiUtils.extendUserInformation(entity.id, 'adjacents');
								entity.superiors = JSON.parse(JSON.stringify(adjacents.superiors));
								entity.directReports = JSON.parse(JSON.stringify(adjacents.directReports));
							}
							if (gcTool.export.extended.phoneAlertTimeouts) {
								let voicemailPolicy = await apiUtils.extendUserInformation(entity.id, 'phoneAlertTimeouts');
								entity.alertTimeoutSeconds = voicemailPolicy.alertTimeoutSeconds;
							}
						}

						if (gcTool.export.include.locations && gcTool.export.resolve.locations) {
							entity.locations.forEach((location) => {
								let foundIndex = usersLocationIds.findIndex(element => element === location.locationDefinition.id);
								if (foundIndex == -1) {
									usersLocationIds.push(location.locationDefinition.id);
								}
							});
						}
						if (gcTool.export.include.groups && gcTool.export.resolve.groups) {
							entity.groups.forEach((group) => {
								let foundIndex = usersGroupIds.findIndex(element => element === group.id);
								if (foundIndex == -1) {
									usersGroupIds.push(group.id);
								}
							});
						}
						if (gcTool.export.resolve.managers) {
							if (entity.manager && entity.manager.id && entity.manager.id.length > 0) {
								let foundIndex = usersManagerIds.findIndex(element => element === entity.manager.id);
								if (foundIndex == -1) {
									usersManagerIds.push(entity.manager.id);
								}
							}
						}
					}

					if (gcTool.debugLevel >= 1) console.log(`    Resolving Locations and Groups...`);
					if (gcTool.export.include.locations && gcTool.export.resolve.locations) {
						if (usersLocationIds.length > 0) {
							resolvedLocations = await this._resolveEntities(gcTool, usersLocationIds, 'locations');
						}
					}
					if (gcTool.export.include.groups && gcTool.export.resolve.groups) {
						if (usersGroupIds.length > 0) {
							resolvedGroups = await this._resolveEntities(gcTool, usersGroupIds, 'groups');
						}
					}
					if (gcTool.export.resolve.managers) {
						if (usersManagerIds.length > 0) {
							resolvedManagers = await this._resolveEntities(gcTool, usersManagerIds, 'managers');
						}
					}
					if ((gcTool.export.resolve.managers) || (gcTool.export.include.locations && gcTool.export.resolve.locations) || (gcTool.export.include.groups && gcTool.export.resolve.groups)) {
						this.selected.forEach((entity) => {
							if (gcTool.export.include.locations && gcTool.export.resolve.locations) {
								if (entity.locations && entity.locations.length > 0) {
									entity.locations.forEach((location) => {
										location.locationDefinition.name = resolvedLocations[location.locationDefinition.id].name;
									});

								}
							}
							if (gcTool.export.include.groups && gcTool.export.resolve.groups) {
								if (entity.groups && entity.groups.length > 0) {
									entity.groups.forEach((group) => {
										if (resolvedGroups.hasOwnProperty(group.id)) {
											group.name = resolvedGroups[group.id].name;
											group.memberCount = resolvedGroups[group.id].memberCount;
											group.type = resolvedGroups[group.id].type;
											group.visibility = resolvedGroups[group.id].visibility;
										} else {
											// Unknown/Hidden groups
											group.name = 'Hidden';
											group.memberCount = 0;
											group.type = 'Hidden';
											group.visibility = 'Hidden';
										}
									});
								}
							}
							if (gcTool.export.resolve.managers) {
								if (entity.manager && entity.manager.id && entity.manager.id.length > 0) {
									if (resolvedManagers.hasOwnProperty(entity.manager.id)) {
										entity.manager.email = resolvedManagers[entity.manager.id].email;
										entity.manager.name = resolvedManagers[entity.manager.id].name;
										entity.manager.state = resolvedManagers[entity.manager.id].state;
										entity.manager.department = resolvedManagers[entity.manager.id].department ? resolvedManagers[entity.manager.id].department : '';
										entity.manager.title = resolvedManagers[entity.manager.id].title ? resolvedManagers[entity.manager.id].title : '';
									} else {
										// Unknown/Hidden users
										entity.manager.email = '';
										entity.manager.name = '';
										entity.manager.department = '';
										entity.manager.title = '';
										entity.manager.state = 'unknown';
									}
								}
							}
						});
					}

					console.log(`    Extended Users profile completed at:`, new Date(Date.now()).toISOString());
					return true;

				} else {
					console.log(`Extended Users profile has been interrupted - error retrieving data.`);
					return false;
				}

			} else {
				console.log(`GCUsersTool - App Error - Empty list (selected users) - Exiting...`);
				return false;
			}
		} catch (err) {
			console.error(`Extended Users profile error has occurred.`);
			console.error(`Error: ${JSON.stringify(err, null, 4)}`);
			return false;
		}
	}

	exportToFile(gcTool, jsonTransformMethod, csvTransformInitMethod, csvTransformMethod) {
		try {
			if (this.selected && this.selected.length > 0 && gcTool.export.as && gcTool.export.file && gcTool.export.file.length > 0) {
				console.log(`    Starting export of Users to file at:`, new Date(Date.now()).toISOString());

				let filename;
				if (gcTool.export.as === 'csv') {
					filename = gcTool.export.file + '.csv';
				} else {
					filename = gcTool.export.file + '.json';
				}
				let writeStream = fs.createWriteStream(filename);

				switch (gcTool.export.as) {
					case 'csv':
						// With CSV, a subset of the contact's attributes are exported to the file
						// CALL FUNCTION TO SET CSV HEADERS
						let csvHeaders = csvTransformInitMethod(gcTool);
						let csvStream = csv.format({ headers: csvHeaders, delimiter: gcTool.export.fieldSeparator });
						csvStream.pipe(writeStream);
						this.selected.forEach((user) => {
							// CALL FUNCTION TO TRANSFORM USER JSON OBJECT
							let csvRow = csvTransformMethod(gcTool, user);
							if (csvRow) {
								csvStream.write(csvRow);
							}
						});
						csvStream.end();
						if (writeStream) {
							writeStream.end();
						}
						break;
					case 'json':
						let transformedUsersList = [];
						this.selected.forEach((user) => {
							// CALL FUNCTION TO TRANSFORM USER JSON OBJECT
							let transformedUser = jsonTransformMethod(gcTool, user);
							if (transformedUser) {
								transformedUsersList.push(transformedUser);
							}
						});
						let transformedUsersAsString = JSON.stringify(transformedUsersList);
						writeStream.write(transformedUsersAsString);
						writeStream.end();
						break;
					case 'jsonMap':
						// Raw JSON Map - jsonMap
						let usersMap = {};
						this.selected.forEach((user) => {
							usersMap[user.id] = user;
						});
						let usersMapAsString = JSON.stringify(usersMap);
						writeStream.write(usersMapAsString);
						writeStream.end();
						break;
					default:
						// Default - Raw JSON Array - jsonArray
						let usersListAsString = JSON.stringify(this.selected);
						writeStream.write(usersListAsString);
						writeStream.end();
						break;
				}

				return true;
			} else {
				console.error(`Error - it is not possible to export data to file - Exiting...`);
				return false;
			}
		} catch (err) {
			console.log(`An error has occurred - Exiting...`);
			console.error(`Error: ${JSON.stringify(err, null, 4)}`);
			return false;
		}
	}

}

module.exports = GCUsers;
