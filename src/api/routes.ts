/* tslint:disable */
/* eslint-disable */
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { TsoaRoute, fetchMiddlewares, KoaTemplateService } from '@tsoa/runtime';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { ThermostatController } from './controller/ThermostatController';
import { iocContainer } from './../ioc/tsyringeTsoaIocContainer';
import type { IocContainer, IocContainerFactory } from '@tsoa/runtime';
import type { Context, Next, Middleware, Request as KRequest, Response as KResponse } from 'koa';
import type * as KoaRouter from '@koa/router';


// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

const models: TsoaRoute.Models = {
    "UpdateTemperature": {
        "dataType": "refObject",
        "properties": {
            "temperature": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ThermostatInfo": {
        "dataType": "refObject",
        "properties": {
            "targetTemperature": {"dataType":"double","required":true},
            "lowestTemperature": {"dataType":"double","required":true},
            "highestTemperature": {"dataType":"double","required":true},
            "delta": {"dataType":"double","required":true},
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


        router.put('/v1/thermostat/temperature',
            ...(fetchMiddlewares<Middleware>(ThermostatController)),
            ...(fetchMiddlewares<Middleware>(ThermostatController.prototype.updateTemperature)),

            async function ThermostatController_updateTemperature(context: Context, next: Next) {
            const args: Record<string, TsoaRoute.ParameterSchema> = {
                    update: {"in":"body","name":"update","required":true,"ref":"UpdateTemperature"},
            };

            let validatedArgs: any[] = [];
            try {
              validatedArgs = templateService.getValidatedArgs({ args, context, next });
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
              methodName: 'updateTemperature',
              controller,
              context,
              validatedArgs,
              successStatus: undefined,
            });
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        router.get('/v1/thermostat/info',
            ...(fetchMiddlewares<Middleware>(ThermostatController)),
            ...(fetchMiddlewares<Middleware>(ThermostatController.prototype.getInfo)),

            async function ThermostatController_getInfo(context: Context, next: Next) {
            const args: Record<string, TsoaRoute.ParameterSchema> = {
            };

            let validatedArgs: any[] = [];
            try {
              validatedArgs = templateService.getValidatedArgs({ args, context, next });
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
        router.get('/v1/thermostat',
            ...(fetchMiddlewares<Middleware>(ThermostatController)),
            ...(fetchMiddlewares<Middleware>(ThermostatController.prototype.getMeasurement)),

            async function ThermostatController_getMeasurement(context: Context, next: Next) {
            const args: Record<string, TsoaRoute.ParameterSchema> = {
            };

            let validatedArgs: any[] = [];
            try {
              validatedArgs = templateService.getValidatedArgs({ args, context, next });
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
