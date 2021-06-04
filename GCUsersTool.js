'use strict';

/*
------------------------------------------------------------------------------
* Copyright 2021 JSM (Genesys.com), Inc. or its affiliates. All Rights Reserved.
------------------------------------------------------------------------------
*/

// Import Genesys Cloud Platform API library
const platformClient = require('purecloud-platform-client-v2');
const client = platformClient.ApiClient.instance;

const GCTool = require('./libs/GCTool');
const usersTool = new GCTool();

const GCUsers = require('./libs/GCUsers');
const usersSelection = new GCUsers();

const apiUtils = require('./libs/gcApiUtils');
const transformUtils = require('./customize/GCTransformUtils');

//#region Resolve GUIDs (Globally unique identifiers) into object/name, Extend Users profile

function getHomeDivisionFromMap(divisionsMap) {

    let homeDivision = {
        'id': '',
        'name': ''
    };

    let divisionNames = Object.keys(divisionsMap);

    divisionNames.forEach((divisionName) => {
        let division = divisionsMap[divisionName];
        if (division.homeDivision) {
            homeDivision.id = division.id;
            homeDivision.name = division.name;
        }
    });

    return homeDivision;
}

async function getDivisionsMap(gcTool) {

    let divisionsMap = {};

    let searchSettings = gcTool.getResolveSettings('divisions');

    let divisionsResultList = await apiUtils.searchAllPages([], searchSettings, 0);

    if (divisionsResultList) {
        divisionsResultList.forEach((division) => {
            divisionsMap[division.name] = JSON.parse(JSON.stringify(division));
        });
    }

    return divisionsMap;
}

async function getRolesMap(gcTool, roleNames) {

    let rolesMap = {};

    if (roleNames && roleNames.length > 0) {
        let searchSettings = gcTool.getResolveSettings('roles');

        let searchReqestList = roleNames.map(obj => {
            let rObj = {
                'id': obj
            };
            return rObj
        })

        let rolesResultList = await apiUtils.searchAllPages(searchReqestList, searchSettings, 0);

        if (rolesResultList) {
            rolesResultList.forEach((role) => { rolesMap[role.name] = JSON.parse(JSON.stringify(role)); });
        }
    }

    return rolesMap;
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

        // Loading the Tool settings (from configuration file, with override from command line arguments)
        let isSuccess = usersTool.loadSettings();
        if (isSuccess) {
            if (usersTool.debugLevel) {
                apiUtils.setDebug(usersTool.debugLevel);
            }
            if (usersTool.debugLevel >= 1) console.log(`GCUsersTool - Settings Loaded - Time:`, new Date(Date.now()).toISOString());

            // Loading the list of values used in users selection (ex: skill names, group names, role names, email addresses, phone numbers, ...)
            let selectInputList = await usersTool.loadSelectUsersInput();
            if (selectInputList && selectInputList.length > 0) {
                if (usersTool.debugLevel >= 1) console.log(`GCUsersTool - Select Input Loaded (${selectInputList.length} values) - Time:`, new Date(Date.now()).toISOString());
                if (usersTool.debugLevel >= 1) {
                    if (usersTool.selectUsers.filterConditionsAsAnd) {
                        console.log(`DEBUG - The tool will perform a search on ${usersTool.selectUsers.byType} with AND condition.`);
                    } else {
                        console.log(`DEBUG - The tool will perform a search on ${usersTool.selectUsers.byType} with OR condition.`);
                    }
                    if (usersTool.selectUsers.enablePostSelectionFilter) {
                        console.log(`DEBUG - After selecting users via API, the tool will filter the results, using the post-selection filter method (customizable).`);
                    }
                }

                // Connect to the Genesys Cloud environment
                client.setEnvironment(usersTool.oauth.orgRegion);
                let creds = await client.loginClientCredentialsGrant(usersTool.oauth.clientID, usersTool.oauth.clientSecret);
                if (usersTool.debugLevel >= 1) console.log(`GCUsersTool - Login Success (Token will expire on: ${creds.tokenExpiryTimeString}) - Time:`, new Date(Date.now()).toISOString());

                // Management Operations
                // Step 1
                // Select users based on the provided search criteria (skill, email, role, ...) and the list of values (list of skill names, of emails, of role names, ...)
                await usersSelection.selectUsers(usersTool, selectInputList);
                if (usersSelection.selected && usersSelection.selected.length > 0) {
                    if (usersTool.debugLevel >= 1) console.log(`GCUsersTool - Successfully searched users - Found ${usersSelection.selected.length} users.`);

                    await usersSelection.filterUsers(usersTool, transformUtils.postSelectionFilter);
                    if (usersSelection.selected && usersSelection.selected.length > 0) {
                        // Step 2 - Perform requested management operation

                        if (usersTool.action === 'updateRoles') {
                            let removeRolesMap = await getRolesMap(usersTool, usersTool.update.roles.remove);

                            let addRolesMap = await getRolesMap(usersTool, Object.keys(usersTool.update.roles.add));
                            Object.keys(addRolesMap).forEach((roleName) => {
                                addRolesMap[roleName].updateRequestedDivisions = usersTool.update.roles.add[roleName];
                            });

                            let divisionsMap = await getDivisionsMap(usersTool);
                            let homeDivision = getHomeDivisionFromMap(divisionsMap);

                            if (usersTool.verifyInput > 0) {
                                if (usersTool.update.roles.remove.length != Object.keys(removeRolesMap).length) {
                                    console.log(`ToolWarning: verify input on remove roles - Number of requested roles to remove (${usersTool.update.roles.remove.length}) does not match the number of found roles (${Object.keys(removeRolesMap).length}).`);
                                    if (usersTool.debugLevel >= 1) {
                                        let unknownRemoveRoles = [];
                                        usersTool.update.roles.remove.forEach((roleName) => {
                                            if (!removeRolesMap[roleName]) {
                                                // Not found
                                                unknownRemoveRoles.push(roleName);
                                            }
                                        });
                                        console.log(`DEBUG - Unknown Roles to remove:`, unknownRemoveRoles);
                                    }
                                    if (usersTool.verifyInput == 2) {
                                        console.log(`ToolError: Tool is configured to exit if an input value is unknown/not found - Exiting...`);
                                        return null;
                                    }
                                } else {
                                    // as many - do nothing
                                }
                                if (Object.keys(usersTool.update.roles.add).length != Object.keys(addRolesMap).length) {
                                    console.log(`ToolWarning: verify input on add roles - Number of requested roles to add (${Object.keys(usersTool.update.roles.add).length}) does not match the number of found roles (${Object.keys(addRolesMap).length}).`);
                                    if (usersTool.debugLevel >= 1) {
                                        let unknownAddRoles = [];
                                        Object.keys(usersTool.update.roles.add).forEach((roleName) => {
                                            if (!addRolesMap[roleName]) {
                                                // Not found
                                                unknownAddRoles.push(roleName);
                                            }
                                        });
                                        console.log(`DEBUG - Unknown Roles to add:`, unknownAddRoles);
                                    }
                                    if (usersTool.verifyInput == 2) {
                                        console.log(`ToolError: Tool is configured to exit if an input value is unknown/not found - Exiting...`);
                                        return null;
                                    }
                                } else {
                                    // as many - do nothing
                                }
                            }

                            // Update the roles of the selected users
                            let bulkUpdateResult = await usersSelection.updateRoles(usersTool, removeRolesMap, addRolesMap, divisionsMap, homeDivision);

                            if (bulkUpdateResult) {
                                console.log(`GCUsersTool - Successfully updated roles - Time:`, new Date(Date.now()).toISOString());
                                if (usersTool.debugLevel >= 1) {
                                    console.log(`    Input Users: ${bulkUpdateResult.input}.`);
                                }
                                return;
                            } else {
                                console.log(`GCUsersTool - App Error - An error occured during the bulk update of roles - Exiting...`);
                                return;
                            }

                        } else if (usersTool.action === 'updateACDAutoAnswer') {
                            // Update the ACD Auto-Answer value of the selected users
                            let bulkChangeResult = await usersSelection.changeACDAutoAnswer(usersTool, usersTool.update.acdAutoAnswer);

                            if (bulkChangeResult) {
                                console.log(`GCUsersTool - Successfully changed ACD auto-answer to ${usersTool.update.acdAutoAnswer.turnOn} - Time:`, new Date(Date.now()).toISOString());
                                if (usersTool.debugLevel >= 1) {
                                    console.log(`    Input Users: ${bulkChangeResult.input}.`);
                                    console.log(`    Users Ignored (reason - state deleted): ${bulkChangeResult.deleted}.`);
                                    console.log(`    Users Ignored (reason - ACD Auto-Answer already set): ${bulkChangeResult.alreadySet}.`);
                                    console.log(`    Updated Users: ${bulkChangeResult.updated}.`);
                                }
                                return;
                            } else {
                                console.log(`GCUsersTool - App Error - An error occured during the bulk change of ACD Auto-Answer - Exiting...`);
                                return;
                            }
                        } else if (usersTool.action === 'export') {
                            // Extend user profile information
                            // - retrieving information about queues, roles with divisions, ... (requests per user)
                            // - resolving entities referenced by a GUID (locations, groups, managers) into names/emails/types...
                            let extendedUsersResult = await usersSelection.extendProfile(usersTool);
                            if (extendedUsersResult) {
                                if (usersTool.debugLevel >= 1) console.log(`GCUsersTool - Successfully Extended Users Profile.`);

                                if (usersSelection.selected.length > 0) {
                                    if (usersTool.debugLevel >= 1) console.log(`GCUsersTool - Starting Export to file (${usersSelection.selected.length} selected users) - Time:`, new Date(Date.now()).toISOString());

                                    // Export users profile information to a file
                                    await usersSelection.exportToFile(usersTool, transformUtils.jsonTransform, transformUtils.csvTransformInit, transformUtils.csvTransform);
                                    console.log(`GCUsersTool - Successfully Exported Users to file - Time:`, new Date(Date.now()).toISOString());
                                    return;
                                } else {
                                    console.log(`GCUsersTool - App Error - No data to export to file - Exiting...`);
                                    return;
                                }
                            } else {
                                console.log(`GCUsersTool - App Error - An error occured while extending users profile - Exiting...`);
                                return;
                            }
                        } else if (usersTool.action === 'test') {
                            console.log(`GCUsersTool - Successfully test - Time:`, new Date(Date.now()).toISOString());
                        }

                    } else {
                        console.log(`GCUsersTool - App Error - No users found/selected - Exiting...`);
                        return;
                    }
                } else {
                    console.log(`GCUsersTool - App Error - No users found/selected - Exiting...`);
                    return;
                }
            } else {
                // Force Exit
                console.log(`GCUsersTool - App Error - Empty input list for users selection - Exiting...`);
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
