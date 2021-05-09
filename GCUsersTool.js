'use strict';

/*
------------------------------------------------------------------------------
* Copyright 2021 JSM@Genesys.com, Inc. or its affiliates. All Rights Reserved.
------------------------------------------------------------------------------
*/

// Import needed built in and external libraries.

// Import Genesys Cloud Platform API library
const platformClient = require('purecloud-platform-client-v2');
const client = platformClient.ApiClient.instance;

const apiUtils = require('./services/gcApiUtils');
const toolUtils = require('./services/gcToolUtils');
const transformUtils = require('./GCTransformExportUtils');

// Debug
const GC_DEBUG = true;

/*
------------------------------------------------------------------------------
* Load, Scan, Export
------------------------------------------------------------------------------
*/

//#region Retrieve Users

async function selectUsersByType(inputList, settings) {

    let searchSettings = toolUtils.getSearchSettings(settings);

    let includeUsers = [];
    if ((settings.selectUsers.include.active) && ((settings.selectUsers.include.inactive) || (settings.selectUsers.include.deleted))) {
        includeUsers.push('active');
    }
    if (settings.selectUsers.include.inactive) {
        includeUsers.push('inactive');
    }
    if (settings.selectUsers.include.deleted) {
        includeUsers.push('deleted');
    }

    let searchRequestList = inputList;
    let searchResultList = null;
    for (let i = 0; i < searchSettings.length; i++) {
        let thisSearchSettings = searchSettings[i];
        if (i == 0 && settings.selectUsers.byType === 'custom') {
            searchResultList = await apiUtils.searchAllPages(searchRequestList, thisSearchSettings.maxItems, thisSearchSettings.usingApi, thisSearchSettings.expandList, thisSearchSettings.queryFields, includeUsers, settings.selectUsers.withCustomFilter);
        } else if (thisSearchSettings.usingApi === 'roles') {
            searchResultList = await apiUtils.searchAllPagesWithRoles(searchRequestList, thisSearchSettings.maxItems);
        } else {
            searchResultList = await apiUtils.searchAllPages(searchRequestList, thisSearchSettings.maxItems, thisSearchSettings.usingApi, thisSearchSettings.expandList, thisSearchSettings.queryFields, includeUsers, null);
        }
        searchRequestList = searchResultList;
    }
    // searchResultList should be the list of selected users (final)
    return searchResultList;
}

async function extendUserProfile(usersList, settings) {
    try {
        if (settings.export.extended.queues || settings.export.extended.directReports || settings.export.extended.managers || settings.export.extended.phoneAlertTimeouts || settings.export.extended.rolesDivisions || settings.export.resolve.managers || (settings.export.include.locations && settings.export.resolve.locations) || (settings.export.include.groups && settings.export.resolve.groups)) {
            console.log(`GCUsersTool - Starting to retrieve extended Users profile at:`, new Date(Date.now()).toISOString());
        } else {
            console.log(`GCUsersTool - No extended Users profile requested - Proceeding...`);
            return usersList;
        }

        let usersGroupIds = [];
        let resolvedGroups = {};
        let usersLocationIds = [];
        let resolvedLocations = {};
        let usersManagerIds = [];
        let resolvedManagers = {};

        if (usersList) {
            for (let entityIndex in usersList) {
                let entity = usersList[entityIndex];

                if (GC_DEBUG) console.log(`    Extending Users profile for user with id:`, entity.id);

                if (settings.export.extended.queues) {
                    let queues = await apiUtils.getUserQueues(entity.id);
                    if (queues && queues.length > 0) {
                        entity.queues = JSON.parse(JSON.stringify(queues));
                    } else {
                        entity.queues = [];
                    }
                }
                if (settings.export.extended.rolesDivisions) {
                    let userGrants = await apiUtils.getUserRolesDivisions(entity.id);
                    entity.grants = JSON.parse(JSON.stringify(userGrants.grants));
                }

                if (entity.state != 'deleted') {
                    if (settings.export.extended.directReports || settings.export.extended.managers) {
                        let adjacents = await apiUtils.getUserAdjacents(entity.id);
                        entity.superiors = JSON.parse(JSON.stringify(adjacents.superiors));
                        entity.directReports = JSON.parse(JSON.stringify(adjacents.directReports));
                    }
                    if (settings.export.extended.phoneAlertTimeouts) {
                        let voicemailPolicy = await apiUtils.getUserPhoneAlertTimeout(entity.id);
                        entity.alertTimeoutSeconds = voicemailPolicy.alertTimeoutSeconds;
                    }
                }

                if (settings.export.include.locations && settings.export.resolve.locations) {
                    entity.locations.forEach((location) => {
                        let foundIndex = usersLocationIds.findIndex(element => element === location.locationDefinition.id);
                        if (foundIndex == -1) {
                            usersLocationIds.push(location.locationDefinition.id);
                        }
                    });
                }
                if (settings.export.include.groups && settings.export.resolve.groups) {
                    entity.groups.forEach((group) => {
                        let foundIndex = usersGroupIds.findIndex(element => element === group.id);
                        if (foundIndex == -1) {
                            usersGroupIds.push(group.id);
                        }
                    });
                }
                if (settings.export.resolve.managers) {
                    if (entity.manager && entity.manager.id && entity.manager.id.length > 0) {
                        let foundIndex = usersManagerIds.findIndex(element => element === entity.manager.id);
                        if (foundIndex == -1) {
                            usersManagerIds.push(entity.manager.id);
                        }
                    }
                }
            }

            if (GC_DEBUG) console.log(`    Resolving Locations and Groups...`);
            if (settings.export.include.locations && settings.export.resolve.locations) {
                if (usersLocationIds.length > 0) {
                    resolvedLocations = await apiUtils.resolveLocations(usersLocationIds);
                }
            }
            if (settings.export.include.groups && settings.export.resolve.groups) {
                if (usersGroupIds.length > 0) {
                    resolvedGroups = await apiUtils.resolveGroups(usersGroupIds);
                }
            }
            if (settings.export.resolve.managers) {
                if (usersManagerIds.length > 0) {
                    resolvedManagers = await apiUtils.resolveManagers(usersManagerIds);
                }
            }
            if ((settings.export.resolve.managers) || (settings.export.include.locations && settings.export.resolve.locations) || (settings.export.include.groups && settings.export.resolve.groups)) {
                usersList.forEach((entity) => {
                    if (settings.export.include.locations && settings.export.resolve.locations) {
                        if (entity.locations && entity.locations.length > 0) {
                            entity.locations.forEach((location) => {
                                location.locationDefinition.name = resolvedLocations[location.locationDefinition.id].name;
                            });

                        }
                    }
                    if (settings.export.include.groups && settings.export.resolve.groups) {
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
                    if (settings.export.resolve.managers) {
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
            return usersList;

        } else {
            console.log(`Extended Users profile has been interrupted - error retrieving data.`);
            return null;
        }
    } catch (err) {
        console.error(`Extended Users profile error has occurred.`);
        console.error(`Error: ${JSON.stringify(err, null, 4)}`);
        return null;
    }
}

//#endregion

/*
------------------------------------------------------------------------------
* Main
------------------------------------------------------------------------------
*/

(async () => {
    try {
        console.log(`GCUsersTool - App starting - Time:`, new Date(Date.now()).toISOString());

        let appSettings = toolUtils.loadToolSettings();

        if (appSettings) {
            console.log(`GCUsersTool - Settings Loaded - Time:`, new Date(Date.now()).toISOString());

            let selectInputList = await toolUtils.loadSelectUsersInput(appSettings);
            if (selectInputList && selectInputList.length > 0) {
                console.log(`GCUsersTool - Select Input Loaded - Time:`, new Date(Date.now()).toISOString());

                // Set environment
                // const environment = platformClient.PureCloudRegionHosts[appSettings.oauth.orgRegion];
                // if (environment) client.setEnvironment(environment);
                client.setEnvironment(appSettings.oauth.orgRegion);

                let creds = await client.loginClientCredentialsGrant(appSettings.oauth.clientID, appSettings.oauth.clientSecret);
                console.log(`GCUsersTool - Login Success (Token will expire on: ${creds.tokenExpiryTimeString}) - Time:`, new Date(Date.now()).toISOString());

                if (appSettings.action === 'ACDAutoAnswer') {
                    // No need to include or to resolve or to extend
                    let selectedUsers = await selectUsersByType(selectInputList, appSettings);
                    if (selectedUsers && selectedUsers.length > 0) {
                        console.log(`GCUsersTool - Successfully searched users - Found ${selectedUsers.length} users.`);

                        let bulkChangeResult = await apiUtils.changeACDAutoAnswer(selectedUsers, appSettings.acdAutoAnswer.value);
                        if (bulkChangeResult) {
                            console.log(`GCUsersTool - Successfully changed ACD auto-answer to ${appSettings.acdAutoAnswer.value}.`);
                            console.log(`    Input Users: ${bulkChangeResult.input}.`);
                            console.log(`    Users Ignored (reason - state deleted): ${bulkChangeResult.deleted}.`);
                            console.log(`    Users Ignored (reason - ACD Auto-Answer already set): ${bulkChangeResult.alreadySet}.`);
                            console.log(`    Updated Users: ${bulkChangeResult.updated}.`);
                            return;
                        } else {
                            console.log(`Error - An error occured - Exiting...`);
                            return;
                        }
                    } else {
                        console.log(`Error - No users found/selected - Exiting...`);
                        return;
                    }
                } else if (appSettings.action === 'export') {
                    let selectedUsers = await selectUsersByType(selectInputList, appSettings);
                    if (selectedUsers && selectedUsers.length > 0) {
                        console.log(`GCUsersTool - Successfully searched users - Found ${selectedUsers.length} users.`);

                        let extendedUsersResult = await extendUserProfile(selectedUsers, appSettings);
                        if (extendedUsersResult) {
                            console.log(`GCUsersTool - Successfully Extended Users Profile.`);

                            selectedUsers = extendedUsersResult;

                            if (selectedUsers.length > 0) {
                                console.log(`GCUsersTool - Starting Export to file - Time:`, new Date(Date.now()).toISOString());
                                await toolUtils.exportUsersToFile(selectedUsers, appSettings, transformUtils.jsonTransform, transformUtils.csvTransformInit, transformUtils.csvTransform);
                                console.log(`GCUsersTool - Successfully Exported Users to file.`);
                                return;
                            } else {
                                console.log(`No data to export to file - Exiting...`);
                                return;
                            }
                        } else {
                            console.log(`Error - An error occured while extending users profile - Exiting...`);
                            return;
                        }
                    } else {
                        console.log(`Error - No users found/selected - Exiting...`);
                        return;
                    }
                }
            } else {
                // Force Exit
                console.error(`Error - Empty input list for users selection - Exiting...`);
                return;
            }
        } else {
            // Force Exit
            return;
        }
    } catch (err) {
        console.log(`An error has occurred - Exiting...`);
        console.error(`Error: ${JSON.stringify(err, null, 4)}`);
        return;
    }
})();
