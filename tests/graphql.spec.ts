import './_common';

import { DocumentNode } from 'graphql';

import { graphql, wrapPrototype, assignInput, GraphqlInput } from '../src/graphql';
import { Apollo } from '../src';

import gql from 'graphql-tag';

const query: DocumentNode = gql`
  query getBar {
    bar {
      name
    }
  }
`;
const mutation: DocumentNode = gql`
  mutation changeBar {
    changeBar {
      name
    }
  }
`;
const subscription: DocumentNode = gql`
  subscription dataChange {
    dataChange {
      name
    }
  }
`;

describe('wrapPrototype', () => {
  it('should replace with a new method and keep the old one', () => {
    const spy1 = jest.fn();
    const spy2 = jest.fn();

    class Foo {
      public bar() {
        spy1();
      }
    }

    wrapPrototype(Foo)('bar', function () {
      spy2();
    });

    (new Foo()).bar();

    expect(spy1).toHaveBeenCalled();
    expect(spy2).toHaveBeenCalled();
  });
});

describe('assignInput', () => {
  it('should assign a input', () => {
    const spy = jest.fn();
    const input: GraphqlInput = { query };

    /* tslint:disable:variable-name */
    class Foo {
      public __apollo = {
        watchQuery(options) {
          spy(options);
        },
      } as Apollo;
    }

    const foo = new Foo;

    assignInput(foo)(input);

    expect(spy).toHaveBeenCalledWith({
      query: input['query'],
    });
  });
});

describe('graphql', () => {
  let spyWatchQuery: jest.Mock<any>;
  let spyConstructor: jest.Mock<any>;
  let foo: any;
  const input: GraphqlInput = {
    query,
  };

  beforeEach(() => {
    spyWatchQuery = jest.fn();
    spyConstructor = jest.fn();

    const mock = {
      watchQuery(options) {
        spyWatchQuery(options);
        return options;
      },
    };

    @graphql([input])
    class Foo {
      public getBar: any;
      public ngOnInit: Function;

      constructor(...args: any[]) {
        spyConstructor(...args);
      }
    }

    foo = new Foo(mock);

    foo.ngOnInit();
  });

  it('should not include Angular2Apollo in the constructor', () => {
    expect(spyConstructor).toHaveBeenCalledWith();
  });
});

describe(`graphql - query, mutation, subscribe`, () => {
  let spyWatchQuery;
  let spyMutate;
  let spySubscribeToMore;
  let spySubscribe;

  const mock = {
    watchQuery(options) {
      spyWatchQuery(options);
      return {
        subscribeToMore: (opts) => {
          spySubscribeToMore(opts);
        },
      };
    },
    subscribe: (opts) => {
      spySubscribe(opts);
    },
    mutate(options) {
      spyMutate(options);
      return options;
    },
  };

  beforeEach(() => {
    spyWatchQuery = jest.fn();
    spyMutate = jest.fn();
    spySubscribeToMore = jest.fn();
    spySubscribe = jest.fn();
  });

  const createInstance = (decoratorConfig: GraphqlInput[]) => {
    @graphql(decoratorConfig)
    class Foo {
      public ngOnInit: Function;
      public test: Function;
      public test2: Function;

      constructor(apolloMock: any) {
        // tslint:disable-next-line:no-unused-expression
        apolloMock;
      }
    }

    return new Foo(mock);
  };

  it('query - should execute watchQuery with the correct query object', () => {
    const input = [{
      query,
    }];
    const foo = createInstance(input);

    foo.ngOnInit();

    expect(spyWatchQuery).toBeCalledWith({ query });
  });

  it('query - should execute watchQuery with the correct query options', () => {
    const options = {
      variables: {
        test: 1,
      },
    };
    const input = [{
      query,
      options,
    }];
    const foo = createInstance(input);

    foo.ngOnInit();

    expect(spyWatchQuery).toBeCalledWith({query, variables: options.variables});
  });

  it('query - should execute watchQuery with the correct query options (options as function)', () => {
    const optionsValue = {
      variables: {
        test: 1,
      },
    };
    const input = [{
      query,
      options: () => optionsValue,
    }];
    const foo = createInstance(input);

    foo.ngOnInit();

    expect(spyWatchQuery).toBeCalledWith({query, variables: optionsValue.variables});
  });

  it('query - should execute options function with the correct context', () => {
    let context = null;
    const options = (c) => {
      context = c;
    };
    const input = [{
      query,
      options,
    }];
    const foo = createInstance(input);

    foo.ngOnInit();

    expect(context).toBe(foo);
  });

  it('query with subscriptions - should create subscription on call', () => {
    const input = [{
      subscription: subscription,
      name: 'test',
    }];
    const foo = createInstance(input);

    foo.ngOnInit();
    foo.test();

    expect(spySubscribe).toBeCalled();
  });

  it('subscriptions - should create subscription with variables and updateQueries', () => {
    const updateQueries = () => {
      //
    };
    const variables = {
      test: 1,
    };
    const input = [{
      subscription: subscription,
      name: 'test',
      variables,
      updateQueries,
    }];
    const foo = createInstance(input);

    foo.ngOnInit();
    foo.test();

    expect(spySubscribe).toBeCalledWith({ query: subscription, variables, updateQueries});
  });

  it('subscriptions - should execute subscription with variables and updateQueries', () => {
    const updateQueries = () => {
      //
    };
    const variables = {
      test: 1,
    };

    const input = [{
      subscription: subscription,
      name: 'test',
    }];

    const foo = createInstance(input);

    foo.ngOnInit();
    foo.test({
      variables,
      updateQueries,
    });

    expect(spySubscribe).toBeCalledWith({ query: subscription, variables, updateQueries});
  });

  it('query - should execute watchQuery with the correct query options (options as function with fragments)', () => {
    const optionsValue = {
      variables: {
        test: 1,
      },
      fragments: [
        {},
      ],
    };

    const options = () => {
      return optionsValue;
    };
    const input = [{
      query,
      options,
    }];
    const foo = createInstance(input);

    foo.ngOnInit();

    expect(spyWatchQuery).toBeCalledWith({query, variables: optionsValue.variables, fragments: optionsValue.fragments});
  });

  it('mutation - should create execution method on the instance', () => {
    const foo = createInstance([{
      name: 'myMutation',
      mutation,
    }]);

    foo.ngOnInit();

    expect(foo['myMutation']).toBeDefined();
    expect(typeof foo['myMutation']).toBe('function');
  });

  it('mutation - should trigger mutation when executed (without params on call)', () => {
    const foo = createInstance([{
      name: 'mutation',
      mutation,
    }]);

    foo.ngOnInit();
    foo['mutation']();

    expect(spyMutate).toBeCalledWith({mutation});
  });

  const createMutationAndExecuteWith = (executionOptions?: any) => {
    const executionOptionsString = Object.keys(executionOptions).join(', ');

    it(`mutation - should trigger mutation when executed (with ${executionOptionsString})`, () => {
      const foo = createInstance([{
        name: 'mutation',
        mutation,
      }]);

      foo.ngOnInit();
      foo['mutation'](executionOptions);

      expect(spyMutate).toBeCalledWith(Object.assign({mutation}, executionOptions));
    });
  };

  const createMutationWithBase = (creationOptions: any = {}) => {
    const creationOptionsString = Object.keys(creationOptions).join(', ');

    return {
      andExecuteWith: (executionOptions: any = {}) => {
        const executionOptionsString = Object.keys(executionOptions).join(', ');

        it(`mutation - should create with (${creationOptionsString}) and trigger with ${executionOptionsString}`, () => {
          const foo = createInstance([
            Object.assign({
              name: 'mutation',
              mutation,
            },
            creationOptions),
          ]);

          foo.ngOnInit();
          foo['mutation'](executionOptions);

          expect(spyMutate).toBeCalledWith(
            Object.assign({ mutation }, creationOptions, executionOptions),
          );
        });
      },
    };
  };

  createMutationAndExecuteWith({
    variables: {
      test: 1,
    },
  });

  createMutationAndExecuteWith({
    variables: {
      test: 1,
    },
    updateQueries: () => {
      //
    },
  });

  createMutationAndExecuteWith({
    optimisticResponse: {
      __typename: 'changeBar',
      name: 'Test',
    },
  });

  createMutationWithBase({
    updateQueries: () => {
      //
    },
  }).andExecuteWith();

  // Need to use both updateQueries and variables
  createMutationWithBase({
    updateQueries: () => {
      //
    },
  }).andExecuteWith({
    variables: {
      test: 2,
    },
  });

  // Need to override variables
  createMutationWithBase({
    variables: {
      test: 1,
    },
  }).andExecuteWith({
    variables: {
      test: 2,
    },
  });

  // Need to merge variables
  createMutationWithBase({
    variables: {
      test1: 1,
    },
  }).andExecuteWith({
    variables: {
      test2: 2,
    },
  });
});
