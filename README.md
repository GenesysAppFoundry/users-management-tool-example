# Genesys Cloud Users Management tool (example)

A node.js script that encapsulates Genesys Cloud API calls to perform a management operation (export user information to file, update ACD Auto-Answer, update roles) on a set of selected users.

## Providing Tool Settings & Input

***This node.js script can leverage command line arguments, or a json based configuration file, or a combination of both.***

The processing for the Tool settings is the following:

1. The tool checks if there is a `-settings` command line argument, which provides the path to a Tool configuration file.
    * If provided, the tool will load this file and will use it as its base settings.
    * If absent, the tool will load the default *'./config/DefaultToolSettings.json'* file and will use it as its base settings.
    * If no configuration file is found, the tool will use the default settings as a base.
2. The tool then processes command line arguments, to override the tool base settings, if necessary.

_Ex_:
* `node GCUsersTool.js -settings ./config/MyToolSettings.json -action export`
* `npm start -- -settings ./config/MyToolSettings.json -action export`

    _The tool loads a specific configuration file (./config/MyToolSettings.json) and then overrides the action parameter with the value provided in the command line arguments (export)._


## Users Selection

The users can be selected using a list of:
- user emails,
- or user names,
- or user GUIDs,
- or role names,
- or division names,
- or manager (reports to) emails,
- or skill names (routing),
- or language names (routing),
- or location names
- or group names
- or departments
- or primary contact info (phone and email)
- or user addresses (phone only)
- or profile skills
- or certifications

*NB: The tool does not support a combination of different types.*

The values, provided as input (comma separated list of values), can be managed using an OR condition, in the users selection process.  
*i.e. Users who have Skill == 'SkillName1' or Skill == 'SkillName2' ...*

A subset of types can also be managed using an AND condition.  
*i.e. Users who have Skill == 'SkillName1' and Skill == 'SkillName2' ...*  
Types supporting AND condition: skill names, language names, location names, group names, profile skills, certifications.

It is also possible to choose:
- to select all users,
- or to use a custom Search Query filter:

    *Ex: Users who have SkillName1 and SkillName2 and assigned to DepartmentABC*.

Users are additionally filtered according to a list of desired user states (*active*, *inactive*, *deleted*).

Once users are selected, if necessary (and if activated), the tool can refine the selection through a method that you can customize (javascript). The method will be invoked for each of the selected users, passing the user context as input parameter, and you can decide to keep or to remove the user from the initial selection.


## Management operation

### Export

If enabled (tool settings), the tool can query additional user related information (queues, direct reports and superiors, phone alert timeouts, enabled roles with their divisions). But please note that enabling these will have an impact on the tool, in terms of number of triggered API requests and of processing time (*the [number of Genesys Cloud Platform API requests per minute](https://developer.genesys.cloud/api/rest/v2/organization/limits) is constrained by the [API rate limits](https://developer.genesys.cloud/api/rest/rate_limits), which can vary depending on the requested API endpoint*)

The tool can also be configured to resolve information (groups, locations, managers), referenced by an id in the user's profile, adding the related name and other attributes to the user's information.

Once the users are selected, the tool can export the collected information to a json or to a csv file.

The type of export can be:
- a json file with the raw list of users data (JSON Array of users)
- a json map with the raw list ofusers data (JSON Map/Dictionnary of users)
- When exporting to json or to csv type, each user context is processed through a javascript function, that you can customize as you desire.

    In *./customize/GCTransformUtils.js*, modify the *jsonTransform* or the *csvTransform* functions (to filter and transform the data based on your needs).

### ACD Auto-Answer (on/off)

The tool can also be leveraged to enable or to disable the ACD Auto-Answer for the selected users (users in *deleted* state will be ignored).

### Update roles

The tool can also be used to assign and to unassign roles for the selected users.


# Tool Details

## Settings

To configure the tool, you can leverage the json based configuration file, the command line arguments, or a combination of both.

* In the Tool Settings configuration file:
```json
{
    "action": "export",
    "debugLevel": 1,
    "verifyInput": 0,
    "oauth": {
        "clientID": "Your Genesys Cloud OAuth client ClientID (Client Credentials Grant)",
        "clientSecret": "Your Genesys Cloud OAuth client ClientSecret (Client Credentials Grant)",
        "orgRegion": "Your Genesys Cloud Org Region - i.e mypurecloud.com, mypurecloud.ie, ..."
    },
    "selectUsers": {
        "include": ["active", "inactive"],
        "byType": "skill",
        "by": "value",
        "byValue": "TestSkill1,TestSkill2",
        "byFile": "",
        "byFileAs": "json",
        "byFileAttributeName": "email",
        "fieldSeparator": ",",
        "customFilterFile": "./config/DefaultSelectUsersWithCustomFilter.json",
        "filterConditionsAsAnd": false,
        "enablePostSelectionFilter": false,
        "useQ64Pagination": true,
        "useGroupsSearch": false
    },
    "update": {
        "acdAutoAnswer": {
            "turnOn": false,
            "forceUpdate": false
        },
        "roles": {
            "remove": [
                "CustomForUserQueues",
                "PREMIUM_EXAMPLE_Role"
            ],
            "add": {
                "Communicate - User": [
                    "@Home",
                    "CustomDivision",
                    "@User"
                ],
                "PREMIUM_EXAMPLE_Role": [
                    "@User",
                    "CustomDivision"
                ]
            }
        }
    },
    "export": {
        "as": "jsonArray",
        "file": "./GCExportUsersTool_Export_001",
        "fieldSeparator": ",",
        "resolve": {
            "locations": false,
            "groups": false,
            "managers": false
        },
        "extended": {
            "queues": false,
            "directReports": false,
            "managers": false,
            "phoneAlertTimeouts": false,
            "rolesDivisions": false
        },
        "include": {
            "hr": false,
            "biography": false,
            "profileSkills": false,
            "languagePreference": false,
            "certifications": false,
            "locations": false,
            "skills": false,
            "languages": false,
            "roles": false,
            "groups": false
        }
    }
}
```

* As command line arguments:

    * Help:
        - **-help, -h**: *Help (-h, -help)*

    * Override Tool Settings file to load:
        - **-settings**: *./config/DefaultToolSettings.json*

    * Management Operation to perform:
        - **-action**: *'export', 'updateACDAutoAnswer', 'updateRoles', 'test'*

    * Genesys Cloud OAuth Client details (Client Credentials Grant):
        - **-oauthClientID, -oaci**: *Your Genesys Cloud OAuth ClientID*
        - **-oauthClientSecret, -oacs**: *Your Genesys Cloud OAuth ClientSecret*
        - **-oauthOrgRegion, -oaor**: *Your Genesys Cloud Org Region*

    * Users Selection:
        - **-includeUsers, -incu**: *comma separated string with 'active', 'inactive', 'deleted'*
        - **-selectByType, -sbytype**: *'all', 'custom', 'role', 'division', 'email', 'name', 'gcid', 'manager', 'location', 'group', 'language', 'skill', 'profileSkill', 'certification', 'department', 'addresses', 'primaryContactInfo'*
        - **-selectBy, -sby**: *'value', 'file'*
        - **-selectByValue, -sbyval**: *comma separated string (or pipe separated string for select by location)*
        - **-selectByFile, -sbyfile**: *filename*
        - **-selectByFileAs, -sbyfas**: *'jsonMap', 'json', 'jsonArray', 'csv'*
        - **-selectByFileAttributeName, -sbyfan**: *attribute or column name*
        - **-filterConditionsAsAnd, -scondand**: *true/false*
        - **-customFilterFile, -sfilter**: *./config/DefaultSelectUsersWithCustomFilter.json*
        - **-enablePostSelectionFilter**: *true/false*
        - **-verifyInput, -sverify**: *0/1/2*

    * Update ACD Auto-Answer:
        - **-enableACDAutoAnswer, -acdaa**: *'true', 'false', 'forceTrue', 'forceFalse'*

    * Update Roles:
        - **-rolesToRemove, -rolrem**: *comma separated string with role names*
        - **-rolesToAdd, -roladd**: *'role3(division1,@Home),role4(division2,@User)'*

    * Export:
        - **-exportAs, -exas**: *'json', 'csv', 'jsonArray', 'jsonMap'*
        - **-exportFile, -exfile**: *filename (default: './GCExportUsersTool_Export_001')*
        - **-exportResolve, -exres**: *comma separated string with 'Locations', 'Groups', 'Managers'*
        - **-exportExtended, -exext**: *comma separated string with 'Queues', 'DirectReports', 'Managers', 'PhoneAlertTimeouts', 'RolesDivisions'*
        - **-exportInclude, -exinc**: *comma separated string with 'HR', 'Biography', 'ProfileSkills', 'LanguagePreference', 'Certifications', 'Locations', 'Skills', 'Languages', 'Roles', 'Groups'*

    * Debug Level (traces):
        - **-debugLevel, -debug**: *0/1/2*

_Ex_:
* `node GCUsersTool.js -settings ./MyToolSettings.json -action export`
* `npm start -- -settings ./MyToolSettings.json -action export`

## Configuration

* Override Tool Settings file to load:

    * Using the command line arguments,
        - ***-settings**: ./config/DefaultToolSettings.json*

* Configure your Genesys Cloud OAuth Client details (Client Credentials Grant):
    
    Use the values from the [OAuth Client with client credentials grant](https://help.mypurecloud.com/articles/create-an-oauth-client/) you have created in your Genesys Cloud org.

    * Using the command line arguments:
        - ***-oauthClientID, -oaci**: Your Genesys Cloud OAuth ClientID*
        - ***-oauthClientSecret, -oacs**: Your Genesys Cloud OAuth ClientSecret*
        - ***-oauthOrgRegion, -oaor**: Your Genesys Cloud Org Region*
    * Using the configuration file:
        - ***$.oauth.clientID**: Your Genesys Cloud OAuth ClientID*
        - ***$.oauth.clientSecret**: Your Genesys Cloud OAuth ClientSecret*
        - ***$.oauth.orgRegion**: Your Genesys Cloud Org Region*

* Set the Tool Debugging level:
    
    * Using the command line arguments:
        - ***-debugLevel, -debug**: 0/1/2*
    * Using the configuration file:
        - ***$.debugLevel**: 0/1/2*

* Select the management operation to perform:

    The tool can export the collected user data (*'export'*), can enable or disable the ACD Auto-Answer (*'updateACDAutoAnswer'*), or can update the user roles (*'updateRoles'*). It can also run a test (*'test'*) of users selection (no operation performed).

    * Using the command line arguments:
        - ***-action**: 'export', 'updateACDAutoAnswer', 'updateRoles', 'test'*
    * Using the configuration file:
        - ***$.action**: 'export', 'updateACDAutoAnswer', 'updateRoles', 'test'*

* Define how to perform the selection of users:

    1. The tool can select users based on their states (*active*, *inactive*, *deleted*). If none selected, the tool will default to *active*.

        * Using the command line arguments:
            - ***-includeUsers, -incu**: comma separated string with 'active', 'inactive', 'deleted'*
        * Using the configuration file:
            - ***$.selectUsers.include**: ['active', 'inactive', 'deleted']*

    2. The tool can select users based on a list of: *'all', 'custom', 'role', 'division', 'email', 'name', 'gcid', 'manager', 'location', 'group', 'language', 'skill', 'profileSkill', 'certification', 'department', 'addresses', 'primaryContactInfo'*

        * Using the command line arguments:
            - ***-selectByType, -sbytype**: 'all', 'custom', 'role', 'division', 'email', 'name', 'gcid', 'manager', 'location', 'group', 'language', 'skill', 'profileSkill', 'certification', 'department', 'addresses', 'primaryContactInfo'*
        * Using the configuration file:
            - ***$.selectUsers.byType**: 'all', 'custom', 'role', 'division', 'email', 'name', 'gcid', 'manager', 'location', 'group', 'language', 'skill', 'profileSkill', 'certification', 'department', 'addresses', 'primaryContactInfo'*

        When choosing *'all'*, the filter on user states (*'active', 'inactive', 'deleted'*) still applies. Specifying a list of values for selection is of course not necessary in this case.

        When choosing *'custom'*, the tool leverages a custom static filter, as defined in the tools configuration file in ***$.selectUsers.customFilterFile***. Specifying a list of values for selection is of course not necessary in this case.
    
    3. The tool can load the list of values, leveraged in the selection of users, as a comma separated string, or from a file.

        * Using the command line arguments:
            - ***-selectBy, -sby**: 'value', 'file'*
            - ***-selectByValue, -sbyval**: comma separated string (or pipe separated string for select by location)*
            - ***-selectByFile, -sbyfile**: filename*
            - ***-selectByFileAs, -sbyfas**: 'jsonMap', 'json', 'jsonArray', 'csv'*
            - ***-selectByFileAttributeName, -sbyfan**: attribute or column name*
        * Using the configuration file:
            - ***$.selectUsers.by**: 'value', 'file'*
            - ***$.selectUsers.byValue**: comma separated string (or pipe separated string for select by location)*
            - ***$.selectUsers.byFile**: filename*
            - ***$.selectUsers.byFileAs**: 'jsonMap', 'json', 'jsonArray', 'csv'*
            - ***$.selectUsers.byFileAttributeName**: attribute or column name*

        You can select users providing a list of values as a comma separated string (*-selectBy value -selectByValue "Test1, Test2, Test3"*). NB: pipe separated string in case of *-selectBy location*.

        Or you can point to a json or to a csv file (*-selectBy file -selectByFileAs csv -selectByFileAttributeName email -selectByFile ./MyListOfInputValues.csv*).

        - *-selectByFileAttributeName* defines the name of the column (when loading a csv file), or the name of the attribute (when loading a json based file)
        - *-selectByFileAs* defines the type of the file: csv (for a csv file - comma separated value), json or jsonArray (for a json file - array of objects), jsonMap (for a json file - map/dictionary of objects)

    4. The tool can use an OR condition for the list of input values, or can use an AND condition for a subset of types.

        * Using the command line arguments:
            - ***-filterConditionsAsAnd, -scondand**: true/false*
        * Using the configuration file:
            - ***$.selectUsers.filterConditionsAsAnd**: true/false*

        Types supporting AND condition: skill names, language names, location names, group names, profile skills, certifications.
        When using an AND condition, the maximum number of input values is limited to 9 (API constraint).

    5. The tool can also warn the user, or interrupt the processing, if a provided input value does not exist in the system.

        * Using the command line arguments:
            - ***-verifyInput, -sverify**: 0/1/2*
        * Using the configuration file:
            - ***$.verifyInput**: 0/1/2*

        The verification applies to group names, skill names, language names, divisions, locations, and roles.
        When set to 0, there is no verification.
        When set to 1, the tool verifies that the input values exist, warns the user about the ones which don't and continues the processing.
        When set to 2, the tool verifies that the input values exist, warns the user about the ones which don't and interrupts processing.

    6. Once the users have been selected (via the search), the tool can apply another filter, if a more complex selection logic is needed.

        * Using the command line arguments:
            - ***-enablePostSelectionFilter**: true/false*
        * Using the configuration file:
            - ***$.selectUsers.enablePostSelectionFilter**: true/false*

        You can select users providing a list of values as a comma separated string (*-selectBy value -selectByValue "Test1, Test2, Test3"*). NB: pipe separated string in case of *-selectBy location*.


        If you enable the post-selection filter, the tool will trigger the *userPostSelectionFilter* (in *./customize/GCTransformUtils.js*) for each of the selected users. You can adapt these functions to filter based on your needs.

* Define the new value for ACD Auto-Answer (on operation: action = ACDAutoAnswer):

    The tool can enable or disable the ACD Auto-Answer (*'updateACDAutoAnswer'*) for the selected users.

    * Using the command line arguments:
        - ***-enableACDAutoAnswer, -acdaa**: 'true', 'false', 'forceTrue', 'forceFalse'*
    * Using the configuration file:
        - ***$.update.acdAutoAnswer**: {'turnOn': true/false, 'forceUpdate': true/false}*

    Users in *'deleted'* state are ignored.

    With *'true'* or *'false'*, the tool only updates the users if they are in a different acdAutoAnswer status. With *'forceTrue'* or *'forceFalse'*, the tool will request to update all users, whatever their acdAutoAnswer status is.

* Define the roles to add or to remove (on operation: action = updateRoles):

    The tool can add or remove roles (*'updateRoles'*) for the selected users.

    * Using the command line arguments:
        - ***-rolesToRemove, -rolrem**: comma separated string with role names*
        - ***-rolesToAdd, -roladd**: 'role3(division1;@Home),role4(division2;@User)'*
    * Using the configuration file:
        - ***$.update.roles.remove**: ['role1', 'role2']*
        - ***$.update.roles.add**: {'role3': ['division1', '@Home'], 'role4': ['division2', '@User']}*

    The first action is to remove roles for a user. If you need to update and to replace divisions for a role, you can remove the role, and add the role with assigned divisions, in the same management operation.

    Roles are added and enabled for specific divisions. *@Home* and *@User* are keywords - corresponding to the Genesys Cloud Org Home Division, and to the User's Division.

* Define how to export the collected user data (operation: action = export):

    1. The tool can request Genesys Cloud to include more information about a user in a search request (i.e. identical number of API requests, more data exchanged).

        * Using the command line arguments:
            - ***-exportInclude, -exinc**: comma separated string with 'HR', 'Biography', 'ProfileSkills', 'LanguagePreference', 'Certifications', 'Locations', 'Skills', 'Languages', 'Roles', 'Groups'*
        * Using the configuration file:
            - ***$.export.include**: {'hr': true/false, 'biography': true/false, 'profileSkills': true/false, 'languagePreference': true/false, 'certifications': true/false, 'locations': true/false, 'skills': true/false, 'languages': true/false, 'roles': true/false, 'groups': true/false}*

    2. The tool can perform additional requests (per user) to retrieve extended user information, to add information on queues, direct reports and superiors, phone alert timeouts and on roles with their enabled divisions (i.e. increased number of API requests, more data exchanged).

        * Using the command line arguments:
            - ***-exportExtended, -exext**: comma separated string with 'Queues', 'DirectReports', 'Managers', 'PhoneAlertTimeouts', 'RolesDivisions'*
        * Using the configuration file:
            - ***$.export.extended**: {'queues': true/false, 'directReports': true/false, 'managers': true/false, 'phoneAlertTimeouts': true/false, 'rolesDivisions': true/false}*

    3. The tool can also resolve groups, locations and managers information, referended via GUID in the user's profile into plain name/email/type (i.e. limited increase in number of API requests).

        * Using the command line arguments:
            - ***-exportResolve, -exres**: comma separated string with 'Locations', 'Groups', 'Managers'*
        * Using the configuration file:
            - ***$.export.resolve**: {'locations': true/false, 'groups': true/false, 'managers': true/false}*

    4. The tool can export the collected user data to a file (csv or json).

        * Using the command line arguments:
            - ***-exportFile, -exfile**: filename (default: './GCExportUsersTool_Export_001')*
            - ***-exportAs, -exas**: 'json', 'csv', 'jsonArray', 'jsonMap'*
        * Using the configuration file:
            - ***$.export.file**: filename (default: './GCExportUsersTool_Export_001')*
            - ***$.export.as**: 'json', 'csv', 'jsonArray', 'jsonMap'*

        *-exportAs* defines the type of the file: csv, json, jsonArray (for a json file - array of the raw/collected user information), jsonMap (for a json file - dictionary of the raw/collected user information).

        If you select csv or json, the tool will trigger the *jsonTransform* or the *csvTransform* functions (in *./customize/GCTransformUtils.js*) for each of the selected users. You can adapt these functions to filter, to transform the data based on your needs.
    

# Using the tool

## Prerequisites

* npm and node.js (developed using v12)
* A Genesys Cloud org's [OAuth Client with client credentials grant](https://help.mypurecloud.com/articles/create-an-oauth-client/)


## Installation

1. Clone or copy this repo
2. Run `npm install`


## Usage

_Ex 1_:
* `node GCUsersTool.js -settings ./MyToolSettings.json -action export -selectByType skill -selectBy value -sbyval "TestSkill1, TestSkill2"`
* `npm start -- -settings ./MyToolSettings.json -action export -selectByType skill -selectBy value -sbyval "TestSkill1, TestSkill2"`

_Ex 2_:
* `node GCUsersTool.js -action ACDAutoAnswer -enableACDAutoAnswer true -selectByType skill -selectBy value -sbyval "TestSkill1, TestSkill2"`
* `npm start -- -action ACDAutoAnswer -enableACDAutoAnswer true -selectByType skill -selectBy value -sbyval "TestSkill1, TestSkill2"`

