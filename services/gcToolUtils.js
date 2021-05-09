'use strict';

/*
------------------------------------------------------------------------------
* Copyright 2021 JSM@Genesys.com, Inc. or its affiliates. All Rights Reserved.
------------------------------------------------------------------------------
*/

const fs = require('fs');
const csv = require('fast-csv');

const fieldSeparator = ',';

const defaultSettingsFile = './DefaultToolSettings.json';

const toolSupport = {
    'action': ['export', 'ACDAutoAnswer'],
    'selectUsersInclude': ['active', 'inactive', 'deleted'],
    'selectUsersBy': ['value', 'file'],
    'selectUsersByType': ['all', 'custom', 'role', 'email', 'name', 'gcid', 'manager', 'location', 'group', 'language', 'skill', 'profileSkill', 'certification', 'department', 'addresses', 'primaryContactInfo'],
    'selectUsersByFileAs': ['jsonMap', 'json', 'jsonArray', 'csv'],
    'acdAutoAnswerValue': ['true', 'false'],
    'exportAs': ['json', 'csv', 'jsonArray', 'jsonMap'],
    'exportFile': './GCExportUsersTool_Export_001',
    'exportResolve': ['Locations', 'Groups', 'Managers'],
    'exportExtended': ['Queues', 'DirectReports', 'Managers', 'PhoneAlertTimeouts', 'RolesDivisions'],
    'exportInclude': ['HR', 'Biography', 'ProfileSkills', 'LanguagePreference', 'Certifications', 'Locations', 'Skills', 'Languages', 'Roles', 'Groups']
};

const defaultToolSettings = {
    'action': '',
    'oauth': {
        'clientID': '',
        'clientSecret': '',
        'orgRegion': ''
    },
    'acdAutoAnswer': {
        'value': false
    },
    'export': {
        'as': '',
        'file': '',
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
    },
    'selectUsers': {
        'include': {
            'active': false,
            'inactive': false,
            'deleted': false
        },
        'byType': '',
        'by': '',
        'byValue': '',
        'byFile': '',
        'byFileAs': '',
        'byFileAttributeName': ''
    }
};

const supportedSelectByTypes = {
    'email': {
        'maxItems': 5000
    },
    'gcid': {
        'maxItems': 5000
    },
    'name': {
        'maxItems': 5000
    },
    'department': {
        'maxItems': 40
    },
    'manager': {
        'maxItems': 40
    },
    'location': {
        'maxItems': 40
    },
    'group': {
        'maxItems': 40
    },
    'skill': {
        'maxItems': 40
    },
    'profileSkill': {
        'maxItems': 40
    },
    'certification': {
        'maxItems': 40
    },
    'language': {
        'maxItems': 40
    },
    'addresses': {
        'maxItems': 40
    },
    'primaryContactInfo': {
        'maxItems': 40
    },
    'all': {
        'maxItems': 1
    },
    'custom': {
        'maxItems': 1
    },
    'role': {
        'maxItems': 40
    }
};

/*
------------------------------------------------------------------------------
* Tool Utils
------------------------------------------------------------------------------
*/

//#region Load App Settings (Command Arg and ToolSettings file)

const printToolSettingsInformation = function () {
    // Print Tool Information
    console.log(`GCUsersTool: \
    Help (-h, -help):\n \
-settings: ./DefaultToolSettings.json\n \
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
-acdAAValue, -acdaaval: ${toolSupport.acdAutoAnswerValue.toString()}\n \
-exportAs, -exas: ${toolSupport.exportAs.toString()}\n \
-exportFile, -exfile: filename (default: ${toolSupport.exportFile.toString()})\n \
-exportResolve, -exres: comma separated string with ${toolSupport.exportResolve.toString()}\n \
-exportExtended, -exext: comma separated string with ${toolSupport.exportExtended.toString()}\n \
-exportInclude, -exinc: comma separated string with ${toolSupport.exportInclude.toString()}\n \
            `);
}

const verifyToolSettings = function (settings) {

    // check action
    if (toolSupport.action.indexOf(settings.action) > -1) {
        // valid
    } else {
        console.log(`Error - Invalid Settings - action - Exiting...`);
        return null;
    }
    // check selectUsersByType
    if (toolSupport.selectUsersByType.indexOf(settings.selectUsers.byType) > -1) {
        // valid
        if (settings.selectUsers.byType === 'all') {
            settings.selectUsers.by = 'value';
            settings.selectUsers.byValue = 'all';
        } else if (settings.selectUsers.byType === 'custom') {
            settings.selectUsers.by = 'value';
            settings.selectUsers.byValue = 'custom';
        }
    } else {
        console.log(`Error - Invalid Settings - selectUsersByType - Exiting...`);
        return null;
    }
    // check selectUsersBy
    if (toolSupport.selectUsersBy.indexOf(settings.selectUsers.by) > -1) {
        // valid
    } else {
        console.log(`Error - Invalid Settings - selectUsersBy - Exiting...`);
        return null;
    }
    // check selectUsersByFileAs
    if (toolSupport.selectUsersByFileAs.indexOf(settings.selectUsers.byFileAs) > -1) {
        // valid
    } else {
        console.log(`Error - Invalid Settings - selectUsersByFileAs - Exiting...`);
        return null;
    }
    // check exportAs
    if (toolSupport.exportAs.indexOf(settings.export.as) > -1) {
        // valid
    } else {
        console.log(`Error - Invalid Settings - exportAs - Exiting...`);
        return null;
    }

    // check acdAutoAnswerValue override
    if (settings.acdAutoAnswer.valueStr) {
        if (toolSupport.acdAutoAnswerValue.indexOf(settings.acdAutoAnswer.valueStr.toLowerCase()) > -1) {
            if (settings.acdAutoAnswer.valueStr.trim().toLowerCase() === 'true') {
                settings.acdAutoAnswer.value = true;
            } else {
                settings.acdAutoAnswer.value = false;
            }
        } else {
            console.log(`Error - Invalid Settings - acdAutoAnswerValue - Exiting...`);
            return null;
        }
    } else {
        // No check required
    }

    // check selectUsersInclude
    if (settings.selectUsers.includeStr) {
        let includeUsersList = settings.selectUsers.includeStr.split(',');
        // Reset settings.selectUsers.include
        settings.selectUsers.include = {
            'active': false,
            'inactive': false,
            'deleted': false
        };
        for (let i = 0; i < includeUsersList.length; i++) {
            let includeUser = includeUsersList[i].trim().toLowerCase();
            if (toolSupport.selectUsersInclude.indexOf(includeUser) > -1) {
                if (includeUser === 'active') {
                    settings.selectUsers.include.active = true;
                } else if (includeUser === 'inactive') {
                    settings.selectUsers.include.inactive = true;
                } else if (includeUser === 'deleted') {
                    settings.selectUsers.include.deleted = true;
                }
            }
        }
    }

    // check exportResolve
    if (settings.export.resolveStr) {
        let resolveList = settings.export.resolveStr.split(',');
        // Reset settings.export.resolve
        settings.export.resolve = {
            'locations': false,
            'groups': false,
            'managers': false
        };
        for (let i = 0; i < resolveList.length; i++) {
            let resolveResource = resolveList[i].trim();
            if (toolSupport.exportResolve.indexOf(resolveResource) > -1) {
                if (resolveResource === 'Locations') {
                    settings.export.resolve.locations = true;
                } else if (resolveResource === 'Groups') {
                    settings.export.resolve.groups = true;
                } else if (resolveResource === 'Managers') {
                    settings.export.resolve.managers = true;
                }
            }
        }
    }

    // check exportExtended
    if (settings.export.extendedStr) {
        let extendedList = settings.export.extendedStr.split(',');
        // Reset settings.export.extended
        settings.export.extended = {
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
                    settings.export.extended.queues = true;
                } else if (extendedResource === 'DirectReports') {
                    settings.export.extended.directReports = true;
                } else if (extendedResource === 'Managers') {
                    settings.export.extended.managers = true;
                } else if (extendedResource === 'PhoneAlertTimeouts') {
                    settings.export.extended.phoneAlertTimeouts = true;
                } else if (extendedResource === 'RolesDivisions') {
                    settings.export.extended.rolesDivisions = true;
                }
            }
        }
    }

    // check exportInclude
    if (settings.export.includeStr) {
        let includeList = settings.export.includeStr.split(',');
        // Reset settings.export.include
        settings.export.include = {
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
                    settings.export.include.hr = true;
                } else if (includeResource === 'Biography') {
                    settings.export.include.biography = true;
                } else if (includeResource === 'ProfileSkills') {
                    settings.export.include.profileSkills = true;
                } else if (includeResource === 'LanguagePreference') {
                    settings.export.include.languagePreference = true;
                } else if (includeResource === 'Certifications') {
                    settings.export.include.certifications = true;
                } else if (includeResource === 'Locations') {
                    settings.export.include.locations = true;
                } else if (includeResource === 'Skills') {
                    settings.export.include.skills = true;
                } else if (includeResource === 'Languages') {
                    settings.export.include.languages = true;
                } else if (includeResource === 'Roles') {
                    settings.export.include.roles = true;
                } else if (includeResource === 'Groups') {
                    settings.export.include.groups = true;
                }
            }
        }
    }

    // Verify if necessary values are present
    if (settings.selectUsers.by === 'value') {
        if (settings.selectUsers.byValue.trim().length == 0) {
            console.log(`Error - Invalid Settings - selectUsers.byValue must be provided - Exiting...`);
            return null;
        }
    } else if (settings.selectUsers.by === 'file') {
        if (settings.selectUsers.byFile.trim().length == 0) {
            console.log(`Error - Invalid Settings - selectUsers.byFile must be provided - Exiting...`);
            return null;
        }
        if (settings.selectUsers.byFileAttributeName.trim().length == 0) {
            console.log(`Error - Invalid Settings - selectUsers.byFileAttributeName must be provided - Exiting...`);
            return null;
        }
    }
    if (settings.oauth.clientID.trim().length == 0) {
        console.log(`Error - Invalid Settings - oauth.clientID must be provided - Exiting...`);
        return null;
    }
    if (settings.oauth.clientSecret.trim().length == 0) {
        console.log(`Error - Invalid Settings - oauth.clientSecret must be provided - Exiting...`);
        return null;
    }
    if (settings.oauth.orgRegion.trim().length == 0) {
        console.log(`Error - Invalid Settings - oauth.orgRegion must be provided - Exiting...`);
        return null;
    }

    return settings;
}

const loadToolSettings = function () {
    console.log(`    Loading Tool Settings...`);
    let toolSettingsFile = defaultSettingsFile;

    // Check if the command is run for -help or -h (Tool Information)
    // Check also for settings filename - if provided
    if (process.argv.length > 2) {
        for (let argIndex = 2; argIndex < process.argv.length; argIndex++) {
            let argValue = process.argv[argIndex];
            if (argValue.toLowerCase() === '-h' || argValue.toLowerCase() === '-help') {
                // Print Tool Information
                printToolSettingsInformation();
                // Force exit
                console.log(`Exiting...`);
                return null;
            } else if (argValue.toLowerCase() === '-settings') {
                if ((argIndex < process.argv.length - 1)) {
                    let argParamValue = process.argv[argIndex + 1];
                    if (argParamValue && (argParamValue.startsWith('-') == false)) {
                        toolSettingsFile = argParamValue;
                        argIndex++;
                    } else {
                        // Invalid Settings - Force exit
                        console.log(`Unsupported Settings - Exiting...`);
                        return null;
                    }
                } else {
                    // Invalid Settings - Force exit
                    console.log(`Unsupported Settings - Exiting...`);
                    return null;
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
        } else {
            console.log(`No Tool Settings file provided - Proceeding with defaultToolSettings...`);
            toolSettings = { ...defaultToolSettings };
        }
    } catch (err) {
        console.log(`Error loading Tool Settings file (not found, invalid) - Proceeding with defaultToolSettings...`);
        console.error(`Error: ${JSON.stringify(err, null, 4)}`);
        toolSettings = { ...defaultToolSettings };
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
                            case '-action':
                                toolSettings.action = argParamValue;
                                break;
                            case '-oauthClientID':
                                toolSettings.oauth.clientID = argParamValue;
                                break;
                            case '-oauthClientSecret':
                                toolSettings.oauth.clientSecret = argParamValue;
                                break;
                            case '-oauthOrgRegion':
                                toolSettings.oauth.orgRegion = argParamValue;
                                break;
                            case '-includeUsers':
                            case '-incu':
                                toolSettings.selectUsers.includeStr = argParamValue;
                                break;
                            case '-selectByType':
                            case '-sbyt':
                                toolSettings.selectUsers.byType = argParamValue;
                                break;
                            case '-selectBy':
                            case '-sby':
                                toolSettings.selectUsers.by = argParamValue;
                                break;
                            case '-selectByValue':
                            case '-sbyval':
                                toolSettings.selectUsers.byValue = argParamValue;
                                break;
                            case '-selectByFile':
                            case '-sbyfile':
                                toolSettings.selectUsers.byFile = argParamValue;
                                break;
                            case '-selectByFileAs':
                            case '-sbyfas':
                                toolSettings.selectUsers.byFileAs = argParamValue;
                                break;
                            case '-selectByFileAttributeName':
                            case '-sbyfan':
                                toolSettings.selectUsers.byFileAttributeName = argParamValue;
                                break;
                            case '-acdAAValue':
                            case '-acdaaval':
                                toolSettings.acdAutoAnswer.valueStr = argParamValue;
                                break;
                            case '-exportAs':
                            case '-exas':
                                toolSettings.export.as = argParamValue;
                                break;
                            case '-exportFile':
                            case '-exfile':
                                toolSettings.export.file = argParamValue;
                                break;
                            case '-exportResolve':
                            case '-exres':
                                toolSettings.export.resolveStr = argParamValue;
                                break;
                            case '-exportExtended':
                            case '-exext':
                                toolSettings.export.extendedStr = argParamValue;
                                break;
                            case '-exportInclude':
                            case '-exinc':
                                toolSettings.export.includeStr = argParamValue;
                                break;
                            default:
                                isKnownCommandArg = false;
                                break;
                        }
                        if (isKnownCommandArg) {
                            argIndex++;
                        }
                    } else {
                        // Invalid Command Arguments - Force exit
                        console.log(`Unsupported Command Arguments - ${argValue} - Exiting...`);
                        return null;
                    }
                } else {
                    // Invalid Command Arguments - Force exit
                    console.log(`Unsupported Command Arguments - ${argValue} - Exiting...`);
                    return null;
                }
            }
        }
    } catch (err) {
        console.log(`Error processing Command Arguments - Exiting...`);
        console.error(`Error: ${JSON.stringify(err, null, 4)}`);
        return null;
    }

    // Verify values are supported
    toolSettings = verifyToolSettings(toolSettings);

    if (toolSettings) {

        return toolSettings;
    } else {
        console.log(`Error verifying Tool Settings - Exiting...`);
        return null;
    }
}

//#endregion


//#region Load Select Input (from file, from value)

/**
 * Open the CSV and return the parsed contents
 */
function importFromCSV(csvFile) {

    let inputRows = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream(csvFile)
            .pipe(csv.parse({ headers: true, delimiter: fieldSeparator }))
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


    /*
return new Promise((resolve, reject) => {
    fs.createReadStream(csvFile).pipe(parse({ delimiter: ',' },
        (err, data) => {
            if (err) {
                console.log(`An error was encountered: ${err}`);
                reject(err);
            }

            resolve(data);
        }));
});
*/
}

const loadSelectUsersInput = async function (settings) {
    console.log(`    Loading Select Users Input...`);
    let inputList = [];

    if (settings.selectUsers.by === 'value') {
        let rawValue = settings.selectUsers.byValue.trim();
        if (rawValue && rawValue.length > 0) {
            let rawList;
            if (settings.selectUsers.byType === 'location') {
                rawList = rawValue.split('|');
            } else {
                rawList = rawValue.split(fieldSeparator);
            }
            for (let i = 0; i < rawList.length; i++) {
                if (settings.selectUsers.byType === 'manager' || settings.selectUsers.byType === 'email' || settings.selectUsers.byType === 'gcid') {
                    inputList.push({
                        'id': rawList[i].trim().toLowerCase(),
                        'found': false
                    });
                } else {
                    // all, role, group, location, department, name, skill, profileSkill, certification, language, addresses, primaryContactInfo
                    inputList.push({
                        'id': rawList[i].trim(),
                        'found': false
                    });
                }
            }
        }
    } else if (settings.selectUsers.by === 'file') {
        if ((settings.selectUsers.byFileAs === 'json') ||
            (settings.selectUsers.byFileAs === 'jsonArray') ||
            (settings.selectUsers.byFileAs === 'jsonMap')) {
            try {
                let fileContent = fs.readFileSync(settings.selectUsers.byFile);
                let fileContentList = JSON.parse(fileContent);

                if (settings.selectUsers.byFileAs === 'jsonMap') {
                    Object.keys(fileContentList).forEach(function (key) {
                        let entity = fileContentList[key];
                        if (entity[settings.selectUsers.byFileAttributeName]) {
                            if (settings.selectUsers.byType === 'manager' || settings.selectUsers.byType === 'email' || settings.selectUsers.byType === 'gcid') {
                                inputList.push({
                                    'id': entity[settings.selectUsers.byFileAttributeName].trim().toLowerCase(),
                                    'found': false
                                });
                            } else {
                                // all, role, group, location, department, name, skill, profileSkill, certification, language, addresses, primaryContactInfo
                                inputList.push({
                                    'id': entity[settings.selectUsers.byFileAttributeName].trim(),
                                    'found': false
                                });
                            }
                        }
                    });
                } else {
                    fileContentList.forEach(function (entity) {
                        if (entity[settings.selectUsers.byFileAttributeName]) {
                            if (settings.selectUsers.byType === 'manager' || settings.selectUsers.byType === 'email' || settings.selectUsers.byType === 'gcid') {
                                inputList.push({
                                    'id': entity[settings.selectUsers.byFileAttributeName].trim().toLowerCase(),
                                    'found': false
                                });
                            } else {
                                // all, role, group, location, department, name, skill, profileSkill, certification, language, addresses, primaryContactInfo
                                inputList.push({
                                    'id': entity[settings.selectUsers.byFileAttributeName].trim(),
                                    'found': false
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
        } else if (settings.selectUsers.byFileAs === 'csv') {
            try {
                let csvData = await importFromCSV(settings.selectUsers.byFile);

                csvData.forEach((row) => {
                    if (row[settings.selectUsers.byFileAttributeName]) {
                        if (settings.selectUsers.byType === 'manager' || settings.selectUsers.byType === 'email' || settings.selectUsers.byType === 'gcid') {
                            inputList.push({
                                'id': row[settings.selectUsers.byFileAttributeName].trim().toLowerCase(),
                                'found': false
                            });
                        } else {
                            // all, role, group, location, department, name, skill, profileSkill, certification, language, addresses, primaryContactInfo
                            inputList.push({
                                'id': row[settings.selectUsers.byFileAttributeName].trim(),
                                'found': false
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

    return inputList;
}

//#endregion


//#region Filters/Expands by type

function getUsersExpandListByType(settings) {

    let usersExpandList = [];

    if (settings.action === 'ACDAutoAnswer') {
        // Minimum information needed for users - no need for expand
        usersExpandList = [];
    } else if (settings.action === 'export') {
        if (settings.export && settings.export.include) {
            if (settings.export.include.roles && settings.export.include.roles == true) {
                usersExpandList.push('authorization');
            }
            if (settings.export.include.profileSkills && settings.export.include.profileSkills == true) {
                usersExpandList.push('profileSkills');
            }
            if (settings.export.include.certifications && settings.export.include.certifications == true) {
                usersExpandList.push('certifications');
            }
            if (settings.export.include.locations && settings.export.include.locations == true) {
                usersExpandList.push('locations');
            }
            if (settings.export.include.groups && settings.export.include.groups == true) {
                usersExpandList.push('groups');
            }
            if (settings.export.include.skills && settings.export.include.skills == true) {
                usersExpandList.push('skills');
            }
            if (settings.export.include.languages && settings.export.include.languages == true) {
                usersExpandList.push('languages');
            }
            if (settings.export.include.languagePreference && settings.export.include.languagePreference == true) {
                usersExpandList.push('languagePreference');
            }
            if (settings.export.include.hr && settings.export.include.hr == true) {
                usersExpandList.push('employerInfo');
            }
            if (settings.export.include.biography && settings.export.include.biography == true) {
                usersExpandList.push('biography');
            }
        }
    }

    return usersExpandList;
}

function getSearchSettings(settings) {

    let searchSettings = [];

    let usersSearchSetttings;

    switch (settings.selectUsers.byType) {
        case 'gcid':
            usersSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'users',
                expandList: getUsersExpandListByType(settings),
                queryFields: ['id']
            }
            searchSettings.push(usersSearchSetttings);
            break;
        case 'email':
            usersSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'users',
                expandList: getUsersExpandListByType(settings),
                queryFields: ['email']
            }
            searchSettings.push(usersSearchSetttings);
            break;
        case 'name':
            usersSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'users',
                expandList: getUsersExpandListByType(settings),
                queryFields: ['name']
            }
            searchSettings.push(usersSearchSetttings);
            break;
        case 'department':
            usersSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'users',
                expandList: getUsersExpandListByType(settings),
                queryFields: ['department']
            }
            searchSettings.push(usersSearchSetttings);
            break;
        case 'skill':
            usersSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'users',
                expandList: getUsersExpandListByType(settings),
                queryFields: ['routingSkills']
            }
            searchSettings.push(usersSearchSetttings);
            break;
        case 'all':
            usersSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'users',
                expandList: getUsersExpandListByType(settings),
                queryFields: []
            }
            searchSettings.push(usersSearchSetttings);
            break;
        case 'custom':
            usersSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'users',
                expandList: getUsersExpandListByType(settings),
                queryFields: []
            }
            searchSettings.push(usersSearchSetttings);
            break;
        case 'profileSkill':
            usersSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'users',
                expandList: getUsersExpandListByType(settings),
                queryFields: ['profileSkills']
            }
            searchSettings.push(usersSearchSetttings);
            break;
        case 'certification':
            usersSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'users',
                expandList: getUsersExpandListByType(settings),
                queryFields: ['certifications']
            }
            searchSettings.push(usersSearchSetttings);
            break;
        case 'language':
            usersSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'users',
                expandList: getUsersExpandListByType(settings),
                queryFields: ['languages']
            }
            searchSettings.push(usersSearchSetttings);
            break;
        case 'addresses':
            usersSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'users',
                expandList: getUsersExpandListByType(settings),
                queryFields: ['addresses']
            }
            searchSettings.push(usersSearchSetttings);
            break;
        case 'primaryContactInfo':
            usersSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'users',
                expandList: getUsersExpandListByType(settings),
                queryFields: ['primaryContactInfo']
            }
            searchSettings.push(usersSearchSetttings);
            break;
        case 'manager':
            let managersSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'users',
                expandList: [],
                queryFields: ['email']
            }
            searchSettings.push(managersSearchSetttings);
            usersSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'users',
                expandList: getUsersExpandListByType(settings),
                queryFields: ['manager.id']
            }
            searchSettings.push(usersSearchSetttings);
            break;
        case 'group':
            let groupsSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'groups',
                expandList: [],
                queryFields: ['name']
            }
            searchSettings.push(groupsSearchSetttings);
            usersSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'users',
                expandList: getUsersExpandListByType(settings),
                queryFields: ['groups.official.guid', 'groups.social.guid']
            }
            searchSettings.push(usersSearchSetttings);
            break;
        case 'location':
            let locationsSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'locations',
                expandList: [],
                queryFields: ['name']
            }
            searchSettings.push(locationsSearchSetttings);
            usersSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'users',
                expandList: getUsersExpandListByType(settings),
                queryFields: ['location.location.value.guid']
            }
            searchSettings.push(usersSearchSetttings);
            break;
        case 'role':
            let rolesSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'roles',
                expandList: [],
                queryFields: []
            }
            searchSettings.push(rolesSearchSetttings);
            usersSearchSetttings = {
                maxItems: supportedSelectByTypes[settings.selectUsers.byType].maxItems,
                usingApi: 'users',
                expandList: getUsersExpandListByType(settings),
                queryFields: ['id']
            }
            searchSettings.push(usersSearchSetttings);
            break;
        default:
            console.error(`Error - Unsupported SearchBy type: ${settings.selectUsers.byType}`);
            return null;
            break;
    }

    return searchSettings;
}

//#endregion


//#region Export Users to File

const exportUsersToFile = async function (usersList, settings, jsonTransform, csvTransformInit, csvTransform) {
    try {
        if (usersList && usersList.length > 0 && settings.export.as && settings.export.file && settings.export.file.length > 0) {
            console.log(`    Starting export of Users to file at:`, new Date(Date.now()).toISOString());

            let filename;
            if (settings.export.as === 'csv') {
                filename = settings.export.file + '.csv';
            } else {
                filename = settings.export.file + '.json';
            }
            let writeStream = fs.createWriteStream(filename);

            switch (settings.export.as) {
                case 'csv':
                    // With CSV, a subset of the contact's attributes are exported to the file
                    // CALL FUNCTION TO SET CSV HEADERS
                    let csvHeaders = csvTransformInit(settings);
                    let csvStream = csv.format({ headers: csvHeaders, delimiter: fieldSeparator });
                    csvStream.pipe(writeStream);
                    usersList.forEach((user) => {
                        // CALL FUNCTION TO TRANSFORM USER JSON OBJECT
                        let csvRow = csvTransform(user, settings);
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
                    usersList.forEach((user) => {
                        // CALL FUNCTION TO TRANSFORM USER JSON OBJECT
                        let transformedUser = jsonTransform(user, settings);
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
                    usersList.forEach((user) => {
                        usersMap[user.id] = user;
                    });
                    let usersMapAsString = JSON.stringify(usersMap);
                    writeStream.write(usersMapAsString);
                    writeStream.end();
                    break;
                default:
                    // Default - Raw JSON Array - jsonArray
                    let usersListAsString = JSON.stringify(usersList);
                    writeStream.write(usersListAsString);
                    writeStream.end();
                    break;
            }
        } else {
            console.error(`Error - it is not possible to export data to file - Exiting...`);
            return null;
        }
    } catch (err) {
        console.log(`An error has occurred - Exiting...`);
        console.error(`Error: ${JSON.stringify(err, null, 4)}`);
        return null;
    }
}

//#endregion


/*
------------------------------------------------------------------------------
* Module Exports
------------------------------------------------------------------------------
*/

module.exports = {
    loadToolSettings,
    loadSelectUsersInput,
    getSearchSettings,
    exportUsersToFile
};
