# Genesys Cloud Users Management tool (example)

A node.js script that encapsulates Genesys Cloud API calls to perform a management operation (export user information to file, update ACD Auto-Answer) on a set of selected users.

## Providing Tool Settings & Input

***This node.js script can leverage command line arguments, or a json based configuration file, or a combination of both.***

The processing for the Tool settings is the following:

1. The tool checks if there is a `-settings` command line argument, which provides the path to a Tool configuration file.
    * If provided, the tool will load this file and will use it as its base settings.
    * If absent, the tool will load the default *'./DefaultToolSettings.json'* file and will use it as its base settings.
    * If no configuration file is found, the tool will use the default settings as a base.
2. The tool processes command line arguments, to override the tool base settings, if necessary.

_Ex_:
* `node GCUsersTool.js -settings ./MyToolSettings.json -action export`
* `npm start -- -settings ./MyToolSettings.json -action export`

    _The tool loads a specific configuration file (./MyToolSettings.json) and then overrides the action parameter with the value provided in the command line arguments (export)._


## Users Selection

The users can be selected using a list of:
- user emails,
- user names,
- user GUIDs,
- role names,
- manager (reports to) emails,
- skill names (routing),
- language names (routing),
- location names
- group names
- departments
- primary contact info (phone and email) and user addresses (phone only)
- profile skills
- certifications

The values, provided as input (comma separated list of values), are managed using OR in the users selection process.  
*i.e. Users who have Skill == 'SkillName1' or Skill == 'SkillName2' ...*

It is also possible to choose:
- to select all users,
- or to use a custom Search Query filter (defined in the Tool Settings file):

    *Ex: Users who have SkillName1 and SkillName2 and assigned to DepartmentABC*.

Users are additionally filtered according to a list of desired user states (*active*, *inactive*, *deleted*).


## Management operation

### Export

If enabled (tool settings), the tool can query additional user related information (queues, direct reports and superiors, phone alert timeouts, enabled roles with their divisions). But please note that enabling these will have an impact on the tool, in terms of number of triggered API requests and of processing time (*the [number of Genesys Cloud Platform API requests per minute](https://developer.genesys.cloud/api/rest/v2/organization/limits) is constrained by the [API rate limits](https://developer.genesys.cloud/api/rest/rate_limits), whose can vary depending on the requested API endpoint*)

The tool can also be configured to resolve information (groups, locations, managers), referenced by an id in the user's profile, adding the related name and other attributes to the user's information.

Once the users are selected, the tool can export the collected information to a json or to a csv file.

The type of export can be:
- a json file with the raw list of users data (JSON Array of users)
- a json map with the raw list ofusers data (JSON Map/Dictionnary of users)
- When exporting to json or to csv type, each user data is processed through a javascript function, that you can customize as you desire.

    In *GCTransformExportUtils.js*, modify the *jsonTransform* or the *csvTransform* functions (to filter and transform the data based on your needs).

### ACD Auto-Answer (on/off)

The tool can also be leveraged to enable or to disable the ACD Auto-Answer for the selected users (users in *deleted* state will be ignored).

# Tool Details

## Settings

To configure the tool, you can leverage the json based configuration file, the command line arguments, or a combination of both.

* In the Tool Settings configuration file:
```json
{
    "action": "export",
    "oauth": {
        "clientID": "Your Genesys Cloud OAuth client ClientID (Client Credentials Grant)",
        "clientSecret": "Your Genesys Cloud OAuth client ClientSecret (Client Credentials Grant)",
        "orgRegion": "Your Genesys Cloud Org Region - i.e mypurecloud.com, mypurecloud.ie, ..."
    },
    "selectUsers": {
        "include": {
            "active": true,
            "inactive": false,
            "deleted": false
        },
        "byType": "skill",
        "by": "value",
        "byValue": "TestSkill1,TestSkill2",
        "byFile": "",
        "byFileAs": "json",
        "byFileAttributeName": "email",
        "withCustomFilter": [
            {
                "fields": [
                    "routingSkills"
                ],
                "values": [
                    "TestSkill1"
                ],
                "type": "EXACT"
            },
            {
                "fields": [
                    "routingSkills"
                ],
                "values": [
                    "TestSkill2"
                ],
                "type": "EXACT"
            },
            {
                "fields": [
                    "department"
                ],
                "values": [
                    "Contact Center"
                ],
                "type": "EXACT"
            }
        ]
    },
    "acdAutoAnswer": {
        "value": false
    },
    "export": {
        "as": "jsonArray",
        "file": "./GCExportUsersTool_Export_001",
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
        - **-settings**: *./DefaultToolSettings.json*

    * Management Operation to perform:
        - **-action**: *'export', 'ACDAutoAnswer'*

    * Genesys Cloud OAuth Client details (Client Credentials Grant):
        - **-oauthClientID, -oaci**: *Your Genesys Cloud OAuth ClientID*
        - **-oauthClientSecret, -oacs**: *Your Genesys Cloud OAuth ClientSecret*
        - **-oauthOrgRegion, -oaor**: *Your Genesys Cloud Org Region*

    * Users Selection:
        - **-includeUsers, -incu**: *comma separated string with 'active', 'inactive', 'deleted'*
        - **-selectByType, -sbytype**: *'all', 'custom', 'role', 'email', 'name', 'gcid', 'manager', 'location', 'group', 'language', 'skill', 'profileSkill', 'certification', 'department', 'addresses', 'primaryContactInfo'*
        - **-selectBy, -sby**: *'value', 'file'*
        - **-selectByValue, -sbyval**: *comma separated string (or pipe separated string for select by location)*
        - **-selectByFile, -sbyfile**: *filename*
        - **-selectByFileAs, -sbyfas**: *'jsonMap', 'json', 'jsonArray', 'csv'*
        - **-selectByFileAttributeName, -sbyfan**: *attribute or column name*

    * ACD Auto-Answer:
        - **-acdAAValue, -acdaaval**: *'true', 'false'*

    * Export:
        - **-exportAs, -exas**: *'json', 'csv', 'jsonArray', 'jsonMap'*
        - **-exportFile, -exfile**: *filename (default: './GCExportUsersTool_Export_001')*
        - **-exportResolve, -exres**: *comma separated string with 'Locations', 'Groups', 'Managers'*
        - **-exportExtended, -exext**: *comma separated string with 'Queues', 'DirectReports', 'Managers', 'PhoneAlertTimeouts', 'RolesDivisions'*
        - **-exportInclude, -exinc**: *comma separated string with 'HR', 'Biography', 'ProfileSkills', 'LanguagePreference', 'Certifications', 'Locations', 'Skills', 'Languages', 'Roles', 'Groups'*

_Ex_:
* `node GCUsersTool.js -settings ./MyToolSettings.json -action export`
* `npm start -- -settings ./MyToolSettings.json -action export`

## Configuration

* Override Tool Settings file to load:

    * Using the command line arguments,
        - ***-settings**: ./DefaultToolSettings.json*

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

* Select the management operation to perform:

    The tool can export the collected user data (*'export'*) or can enable or disable the ACD Auto-Answer (*'ACDAutoAnswer'*).

    * Using the command line arguments:
        - ***-action**: 'export', 'ACDAutoAnswer'*
    * Using the configuration file:
        - ***$.action**: 'export', 'ACDAutoAnswer'*

* Define how to perform the selection of users:

    1. The tool can select users based on their states (*active*, *inactive*, *deleted*). If none selected, the tool will default to *active*.

        * Using the command line arguments:
            - ***-includeUsers, -incu**: comma separated string with 'active', 'inactive', 'deleted'*
        * Using the configuration file:
            - ***$.selectUsers.include**: {'active': true/false, 'inactive': true/false, 'deleted': true/false}*

    2. The tool can select users based on a list of: *'all', 'custom', 'role', 'email', 'name', 'gcid', 'manager', 'location', 'group', 'language', 'skill', 'profileSkill', 'certification', 'department', 'addresses', 'primaryContactInfo'*

        * Using the command line arguments:
            - ***-selectByType, -sbytype**: 'all', 'custom', 'role', 'email', 'name', 'gcid', 'manager', 'location', 'group', 'language', 'skill', 'profileSkill', 'certification', 'department', 'addresses', 'primaryContactInfo'*
        * Using the configuration file:
            - ***$.selectUsers.byType**: 'all', 'custom', 'role', 'email', 'name', 'gcid', 'manager', 'location', 'group', 'language', 'skill', 'profileSkill', 'certification', 'department', 'addresses', 'primaryContactInfo'*

        When choosing *'all'*, the filter on user states (*'active', 'inactive', 'deleted'*) still applies. Specifying a list of values for selection is of course not necessary in this case.

        When choosing *'custom'*, the tool leverages a custom static filter, as defined in the tools configuration file in ***$.selectUsers.withCustomFilter***. Specifying a list of values for selection is of course not necessary in this case.
    
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
    
* Define the new value for ACD Auto-Answer (on operation: action = ACDAutoAnswer):

    The tool can enable or disable the ACD Auto-Answer (*'ACDAutoAnswer'*) for the selected users.

    * Using the command line arguments:
        - ***-acdAAValue, -acdaaval**: 'true', 'false'*
    * Using the configuration file:
        - ***$.acdAutoAnswer.value**: true/false*

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

        If you select csv or json, the tool will trigger the *jsonTransform* or the *csvTransform* functions (in *GCTransformExportUtils.js*) for each of the selected users. You can adapt these functions to filter, to transform the data based on your needs.
    

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
* `node GCUsersTool.js -action ACDAutoAnswer -acdAAValue true -selectByType skill -selectBy value -sbyval "TestSkill1, TestSkill2"`
* `npm start -- -action ACDAutoAnswer -acdAAValue true -selectByType skill -selectBy value -sbyval "TestSkill1, TestSkill2"`

