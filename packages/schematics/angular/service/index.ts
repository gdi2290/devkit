/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {
  Rule,
  SchematicContext,
  Tree,
  apply,
  branchAndMerge,
  chain,
  filter,
  mergeWith,
  move,
  noop,
  normalizePath,
  template,
  url,
} from '@angular-devkit/schematics';
import 'rxjs/add/operator/merge';
import * as ts from 'typescript';
import * as stringUtils from '../strings';
import { addProviderToModule } from '../utility/ast-utils';
import { InsertChange } from '../utility/change';
import { buildRelativePath, findModuleFromOptions } from '../utility/find-module';
import { Schema as ServiceOptions } from './schema';


function addProviderToNgModule(options: ServiceOptions): Rule {
  return (host: Tree) => {
    if (!options.module) {
      return host;
    }

    const modulePath = options.module;
    const sourceText = host.read(modulePath) !.toString('utf-8');
    const source = ts.createSourceFile(modulePath, sourceText, ts.ScriptTarget.Latest, true);

    const servicePath = `/${options.sourceDir}/${options.path}/`
                        + (options.flat ? '' : stringUtils.dasherize(options.name) + '/')
                        + stringUtils.dasherize(options.name)
                        + '.service';
    const relativePath = buildRelativePath(modulePath, servicePath);
    const changes = addProviderToModule(source, modulePath,
                                        stringUtils.classify(`${options.name}Service`),
                                        relativePath);
    const recorder = host.beginUpdate(modulePath);
    for (const change of changes) {
      if (change instanceof InsertChange) {
        recorder.insertLeft(change.pos, change.toAdd);
      }
    }
    host.commitUpdate(recorder);

    return host;
  };
}

export default function (options: ServiceOptions): Rule {
  options.path = options.path ? normalizePath(options.path) : options.path;

  return (host: Tree, context: SchematicContext) => {
    if (options.module) {
      options.module = findModuleFromOptions(host, options);
    }

    const templateSource = apply(url('./files'), [
      options.spec ? noop() : filter(path => !path.endsWith('.spec.ts')),
      template({
        ...stringUtils,
        'if-flat': (s: string) => options.flat ? '' : s,
        ...options as object,
      }),
      move(options.sourceDir !),
    ]);

    return chain([
      branchAndMerge(chain([
        filter(path => path.endsWith('.module.ts') && !path.endsWith('-routing.module.ts')),
        addProviderToNgModule(options),
        mergeWith(templateSource),
      ])),
    ])(host, context);
  };
}
