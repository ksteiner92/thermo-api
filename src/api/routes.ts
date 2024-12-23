/* tslint:disable */
/* eslint-disable */
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import type { TsoaRoute } from '@tsoa/runtime';
import { fetchMiddlewares, KoaTemplateService } from '@tsoa/runtime';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { ThermostatController } from './controller/ThermostatController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { SensorController } from './controller/SensorController';
import { iocContainer } from './../ioc/tsyringeTsoaIocContainer';
import type { IocContainer, IocContainerFactory } from '@tsoa/runtime';
import type { Context, Next, Middleware, Request as KRequest, Response as KResponse } from 'koa';
import type * as KoaRouter from '@koa/router';


// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

const models: TsoaRoute.Models = {
    "ThermostatStatus": {
        "dataType": "refEnum",
        "enums": ["OFF","COOL","HEAT","IDLE","ERROR","STOPPED"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ThermostatInfo": {
        "dataType": "refObject",
        "properties": {
            "sensorTemperature": {"dataType":"double","required":true},
            "sensorHumidity": {"dataType":"double","required":true},
            "coolSetpoint": {"dataType":"double","required":true},
            "heatSetpoint": {"dataType":"double","required":true},
            "status": {"ref":"ThermostatStatus","required":true},
            "thermostatHeatSetpoint": {"dataType":"double","required":true},
            "thermostatCoolSetpoint": {"dataType":"double","required":true},
            "lowestTemperature": {"dataType":"double","required":true},
            "highestTemperature": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "UpdateSetpoints": {
        "dataType": "refObject",
        "properties": {
            "coolSetpoint": {"dataType":"double","required":true},
            "heatSetpoint": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Measurement": {
        "dataType": "refObject",
        "properties": {
            "humidity": {"dataType":"double","required":true},
            "temperature": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
};
const templateService = new KoaTemplateService(models, {"noImplicitAdditionalProperties":"throw-on-extras","bodyCoercion":true});

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa


export function RegisterRoutes(router: KoaRouter) {

    // ###########################################################################################################
    //  NOTE: If you do not see routes for all of your controllers in this file, then you might not have informed tsoa of where to look
    //      Please look into the "controllerPathGlobs" config option described in the readme: https://github.com/lukeautry/tsoa
    // ###########################################################################################################


        const argsThermostatController_updateSetpoints: Record<string, TsoaRoute.ParameterSchema> = {
                update: {"in":"body","name":"update","required":true,"ref":"UpdateSetpoints"},
        };
        router.put('/v1/thermostat/setpoints',
            ...(fetchMiddlewares<Middleware>(ThermostatController)),
            ...(fetchMiddlewares<Middleware>(ThermostatController.prototype.updateSetpoints)),

            async function ThermostatController_updateSetpoints(context: Context, next: Next) {

            let validatedArgs: any[] = [];
            try {
              validatedArgs = templateService.getValidatedArgs({ args: argsThermostatController_updateSetpoints, context, next });
            } catch (err) {
              const error = err as any;
              error.message ||= JSON.stringify({ fields: error.fields });
              context.status = error.status;
              context.throw(context.status, error.message, error);
            }

            const container: IocContainer = typeof iocContainer === 'function' ? (iocContainer as IocContainerFactory)(context.request) : iocContainer;

            const controller: any = await container.get<ThermostatController>(ThermostatController);
            if (typeof controller['setStatus'] === 'function') {
                controller.setStatus(undefined);
            }

            return templateService.apiHandler({
              methodName: 'updateSetpoints',
              controller,
              context,
              validatedArgs,
              successStatus: undefined,
            });
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsThermostatController_getInfo: Record<string, TsoaRoute.ParameterSchema> = {
        };
        router.get('/v1/thermostat/info',
            ...(fetchMiddlewares<Middleware>(ThermostatController)),
            ...(fetchMiddlewares<Middleware>(ThermostatController.prototype.getInfo)),

            async function ThermostatController_getInfo(context: Context, next: Next) {

            let validatedArgs: any[] = [];
            try {
              validatedArgs = templateService.getValidatedArgs({ args: argsThermostatController_getInfo, context, next });
            } catch (err) {
              const error = err as any;
              error.message ||= JSON.stringify({ fields: error.fields });
              context.status = error.status;
              context.throw(context.status, error.message, error);
            }

            const container: IocContainer = typeof iocContainer === 'function' ? (iocContainer as IocContainerFactory)(context.request) : iocContainer;

            const controller: any = await container.get<ThermostatController>(ThermostatController);
            if (typeof controller['setStatus'] === 'function') {
                controller.setStatus(undefined);
            }

            return templateService.apiHandler({
              methodName: 'getInfo',
              controller,
              context,
              validatedArgs,
              successStatus: undefined,
            });
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsThermostatController_enable: Record<string, TsoaRoute.ParameterSchema> = {
        };
        router.put('/v1/thermostat/enable',
            ...(fetchMiddlewares<Middleware>(ThermostatController)),
            ...(fetchMiddlewares<Middleware>(ThermostatController.prototype.enable)),

            async function ThermostatController_enable(context: Context, next: Next) {

            let validatedArgs: any[] = [];
            try {
              validatedArgs = templateService.getValidatedArgs({ args: argsThermostatController_enable, context, next });
            } catch (err) {
              const error = err as any;
              error.message ||= JSON.stringify({ fields: error.fields });
              context.status = error.status;
              context.throw(context.status, error.message, error);
            }

            const container: IocContainer = typeof iocContainer === 'function' ? (iocContainer as IocContainerFactory)(context.request) : iocContainer;

            const controller: any = await container.get<ThermostatController>(ThermostatController);
            if (typeof controller['setStatus'] === 'function') {
                controller.setStatus(undefined);
            }

            return templateService.apiHandler({
              methodName: 'enable',
              controller,
              context,
              validatedArgs,
              successStatus: undefined,
            });
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsThermostatController_disable: Record<string, TsoaRoute.ParameterSchema> = {
        };
        router.put('/v1/thermostat/disable',
            ...(fetchMiddlewares<Middleware>(ThermostatController)),
            ...(fetchMiddlewares<Middleware>(ThermostatController.prototype.disable)),

            async function ThermostatController_disable(context: Context, next: Next) {

            let validatedArgs: any[] = [];
            try {
              validatedArgs = templateService.getValidatedArgs({ args: argsThermostatController_disable, context, next });
            } catch (err) {
              const error = err as any;
              error.message ||= JSON.stringify({ fields: error.fields });
              context.status = error.status;
              context.throw(context.status, error.message, error);
            }

            const container: IocContainer = typeof iocContainer === 'function' ? (iocContainer as IocContainerFactory)(context.request) : iocContainer;

            const controller: any = await container.get<ThermostatController>(ThermostatController);
            if (typeof controller['setStatus'] === 'function') {
                controller.setStatus(undefined);
            }

            return templateService.apiHandler({
              methodName: 'disable',
              controller,
              context,
              validatedArgs,
              successStatus: undefined,
            });
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSensorController_getMeasurement: Record<string, TsoaRoute.ParameterSchema> = {
        };
        router.get('/v1/sensor',
            ...(fetchMiddlewares<Middleware>(SensorController)),
            ...(fetchMiddlewares<Middleware>(SensorController.prototype.getMeasurement)),

            async function SensorController_getMeasurement(context: Context, next: Next) {

            let validatedArgs: any[] = [];
            try {
              validatedArgs = templateService.getValidatedArgs({ args: argsSensorController_getMeasurement, context, next });
            } catch (err) {
              const error = err as any;
              error.message ||= JSON.stringify({ fields: error.fields });
              context.status = error.status;
              context.throw(context.status, error.message, error);
            }

            const container: IocContainer = typeof iocContainer === 'function' ? (iocContainer as IocContainerFactory)(context.request) : iocContainer;

            const controller: any = await container.get<SensorController>(SensorController);
            if (typeof controller['setStatus'] === 'function') {
                controller.setStatus(undefined);
            }

            return templateService.apiHandler({
              methodName: 'getMeasurement',
              controller,
              context,
              validatedArgs,
              successStatus: undefined,
            });
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa


    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
}

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
